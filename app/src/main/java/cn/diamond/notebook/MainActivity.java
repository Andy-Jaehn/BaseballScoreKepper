package cn.diamond.notebook;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.webkit.*;
import android.util.AtomicFile;
import android.util.Base64;
import android.widget.Toast;
import java.io.*;
import java.nio.charset.StandardCharsets;

/** Offline assets only. AtomicFile commits every UI transition before it is acknowledged. */
public final class MainActivity extends Activity {
    private WebView web;
    private AtomicFile store;
    private byte[] exportBytes;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        store = new AtomicFile(new File(getFilesDir(), "diamond-v1.json"));
        web = new WebView(this);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Storage(), "AndroidStore");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u=request.getUrl();
                if (!"app.local".equals(u.getHost()) || !"https".equals(u.getScheme())) return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));
                String path=u.getPath().substring(1);
                if(path.isEmpty()) path="index.html";
                if(path.contains("..")) return null;
                String mime=path.endsWith(".js")?"text/javascript":path.endsWith(".css")?"text/css":"text/html";
                try {return new WebResourceResponse(mime,"UTF-8",getAssets().open("web/"+path));}
                catch(IOException e){return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));}
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if ("https://github.com/Andy-Jaehn/BaseballScoreKepper".equals(request.getUrl().toString())) {
                    try { startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, request.getUrl())); }
                    catch (android.content.ActivityNotFoundException ignored) { }
                }
                return true;
            }
        });
        setContentView(web);
        web.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
        web.loadUrl("https://app.local/index.html");
    }
    public final class Storage {
        @JavascriptInterface public synchronized String read() {
            try {return new String(store.readFully(),StandardCharsets.UTF_8);}catch(IOException e){return store.getBaseFile().exists()?"READ_ERROR":"";}
        }
        @JavascriptInterface public synchronized boolean write(String data) {
            FileOutputStream out=null;
            try {out=store.startWrite();out.write(data.getBytes(StandardCharsets.UTF_8));store.finishWrite(out);return true;}
            catch(IOException e){if(out!=null)store.failWrite(out);return false;}
        }
        @JavascriptInterface public void exportFile(String name,String data) {
            exportBytes=Base64.decode(data,Base64.DEFAULT);
            runOnUiThread(()->{Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");i.putExtra(Intent.EXTRA_TITLE,name);startActivityForResult(i,10);});
        }
        @JavascriptInterface public void exportJson(String name,String data) {
            exportBytes=data.getBytes(StandardCharsets.UTF_8);
            runOnUiThread(()->{Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("application/json");i.putExtra(Intent.EXTRA_TITLE,name);startActivityForResult(i,10);});
        }
        @JavascriptInterface public void importJson() {
            runOnUiThread(()->{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("*/*");i.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"application/json","text/plain","application/octet-stream"});startActivityForResult(i,11);});
        }
    }
    @Override protected void onActivityResult(int request,int result,Intent data) {
        super.onActivityResult(request,result,data);
        if(request==11 && result==RESULT_OK && data!=null) {
            try(InputStream in=getContentResolver().openInputStream(data.getData());ByteArrayOutputStream bytes=new ByteArrayOutputStream()) {
                byte[] buf=new byte[8192];int n;while((n=in.read(buf))!=-1){if(bytes.size()+n>20*1024*1024)throw new IOException("文件过大");bytes.write(buf,0,n);}
                String json=new String(bytes.toByteArray(),StandardCharsets.UTF_8);
                web.evaluateJavascript("window.receiveArchive("+org.json.JSONObject.quote(json)+")",null);
            }catch(IOException e){Toast.makeText(this,"导入读取失败，请选择不超过 20 MB 的 JSON 文件",Toast.LENGTH_LONG).show();}
            return;
        }
        if(request==10 && result==RESULT_OK && data!=null && exportBytes!=null) {
            try(OutputStream out=getContentResolver().openOutputStream(data.getData())) {out.write(exportBytes);Toast.makeText(this,"文件已保存",Toast.LENGTH_SHORT).show();}
            catch(IOException e){Toast.makeText(this,"导出失败，请重试",Toast.LENGTH_LONG).show();}
        }
        exportBytes=null;
    }
    @Override public void onBackPressed(){web.evaluateJavascript("window.goHome && window.goHome()",null);}
}
