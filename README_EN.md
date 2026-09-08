[中文](README.md)
## Diamond Score is an intuitive, local baseball scoring app. Featuring a fast, plate-appearance-based scoring system and a clean, responsive interface, it supports cumulative multi-game player tracking alongside automated advanced metric calculations.

### User Guide
1. Add Players
From the home screen, tap "Players" to add a name, uniform number (optional), batting side, and throwing arm. Player names must be unique.
Batting side: L (Left), R (Right), S (Switch).
Players can be edited or deleted at any time; historical game data is preserved.
Start a Game
Select "Start Baseball Game" or "Start Softball Game", then assign the official scorer and umpire (the same person may hold both roles).

Search and add players to both rosters, drag ≡ to adjust batting orders, assign fielding positions, confirm the home and away teams, and tap "Enter Game". For slow-pitch softball, a 10th fielding position ("Rover" / "Short Fielder") is available.

2. Record Pitches

- B: Ball.

- S: Strike.

- Foul: Foul ball.

- Fair: Fair ball (triggers the batted-ball sequence).

B/S/O indicators display balls, strikes, and outs. A red base indicator marks a runner on base.

A confirmation prompt appears upon a walk or strikeout. Tap confirm to apply the result, or tap "Undo Pitch" to revert to the previous pitch count. Slow-pitch softball starts with a 1-1 count, and a foul ball with two strikes counts as an out.

3. Record Fair Balls

Tapping "Fair" prompts the scoring flow in sequence:

Landing Location → Trajectory → Fielding Play & Outcome → Runner Movement → Confirm Outcome.

Runners are resolved in descending order: 3B, 2B, 1B, and Batter-Runner. Supported outcomes include earned bases, advancement on error, force outs, and tag outs. Trailing runners cannot pass preceding runners.

Earned advancement and advancement on errors are entered separately. For example, "2 Bases (Earned) + 1 Base (Error)" denotes a double followed by advancing to third base on an error. Base hits, fielder's choices, sacrifice plays, RBIs, and related metrics are determined automatically.

Undo, Game Log, and Substitutions

Undo Play: Reverts B, S, and Foul inputs within the active, incomplete plate appearance. Undo cannot cross into completed plate appearances.

Pitch-by-Pitch Log: Displays team, pitcher, batter, and outcome, ordered from newest to oldest.

Fielding Substitution: Replaces active defensive players or swaps fielding positions. Substitutes automatically inherit the batting slot of the replaced player.

4. Special Situations & Umpire Rulings

Tap the ⋮ menu in the top right corner to log hit-by-pitch, intentional walks, or open umpire rulings.

Intentional walks are disabled with the bases loaded; standard walks and hit-by-pitch awards remain permitted.

Rulings support advancing baserunners 1, 2, or 3 bases, awarding the batter first base, ruling a runner out, or issuing ejections. If an active player is ejected, a substitute must be designated to inherit their fielding position and batting order. All rulings require final confirmation before taking effect.

5. End Game & Game Stats

After three outs, tap "Start Next Half-Inning" or "End Game". Games can also be finalized via the top-right menu.

The post-game screen displays team-by-team batting, pitching, and fielding lines, with Excel export available. "Game History" on the main menu filters or deletes games by year; deleting a game automatically removes its stats from cumulative player totals.

6. Annual Statistics & Backup

In the "Players" tab, select a year and game format (baseball or softball) to view annual totals and export to Excel.

In "Game History", tap "Export JSON by Year" to select and back up completed games. Tap "Import Games JSON" to restore records: duplicate games are skipped automatically, missing players are registered and flagged via prompt, and imported records are fully integrated into career stats.

The application runs entirely offline and saves changes in real time. If the app closes unexpectedly, unfinished games resume automatically upon relaunch.
