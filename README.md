Stormbreaker is a Decky Loader plugin for SteamOS platforms that both prevents and recovers you from a rare SteamOS bug related to the Quick Access Menu (QAM), where in rare cases upon opening, it gets stuck and becomes unresponsive. While rare, it is devastating as controls also become unresponsive, so usually it results in hard resetting the device, losing game progress in the process.

## Table of Contents

- [How It Works](#how-it-works)
- [Technical Explanation](#technical-explanation)
- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Updating Stormbreaker](#updating-stormbreaker)
- [Troubleshooting](#troubleshooting)
- [Motivation](#motivation)
- [Author & Support](#author--support)
- [License](#license)
- [Disclaimer](#disclaimer)

## How It Works

The Quick Access Menu (QAM) is a little window sitting on top of Game Mode. When it opens, Steam tells Game Mode to release the focus and delegates it to the menu, all within a couple of milliseconds. Most of the time the two sort it out in a fraction of a second. But occasionally, the timing lands just wrong and they both grasp for focus at the same time. When this happens, the chaos begins, and instead of one of them winning they start passing it back and forth, hundreds of times a second. Memory starts to balloon and CPU usage remains high. Steam's interface tries to react to every single one of those handoffs, so it gets buried and overwhelmed, stops listening to your button input, and locks up with the game running behind it. It's really quite devastating when you've built up progress and this happens. While rare, it seems to occur more often when running a heavy game in the background, but it can occur in lightweight situations as well.

This is where **Stormbreaker** comes in. It watches for that back and forth, and the moment it sees it, it hides the menu's page for a split second. With one side out of the fight it ends almost instantly, usually in under a second, and then the page comes right back. All you see is a blink, and the best part is you don't lose your progress. I've also added a fallback service called "Automatic Recovery". So if Stormbreaker fails, which my current tests show it shouldn't, Automatic Recovery notices Steam's interface has stopped responding and restarts steamwebhelper, giving control back to you. Once you get the control back and the interface resets, your game will still be running in the background safely, where all you have to do is select resume for your game to jump right back in.

All you have to do is install **Stormbreaker** and it protects you globally. It doesn't matter which plugins you are using or which menu you are in when you open the QAM; you will be protected when it does happen. It runs silently in the background and uses nearly no CPU, merely monitoring the QAM as it opens, as well as steamwebhelper to determine if it is unresponsive from a freeze so that it can recover you from it.

## Technical Explanation

This is for anyone who wants to know the behind-the-scenes workings inside Steam and what Stormbreaker does for mitigation and recovery.

The Steam code below is from the Steam interface files (`steamui/library.js` and `steamui/chunk~2dcc5aaf7.js`, client build `10971728`, the September 2026 stable client). Steam ships it minified, so I've spread it over multiple lines and added comments, but the code itself and its short names are Steam's.

### What happens inside Steam

The Quick Access Menu isn't part of Game Mode's page. It's its own little web page in a native browser view that is created on top of Game Mode's window (Steam internally still calls it `SP BPM_uid0`, short for Big Picture Mode):

```js
// chunk~2dcc5aaf7.js: the QAM component asks for view "QuickAccess"
const p = (0, k.Jo)({ name: "QuickAccess" });

// ...which creates it as a native popup parented to Game Mode's main window
CreateView(e, t, r) {
    let o = r?.ownerWindow?.SteamClient.Browser.GetBrowserID(),  // the main window's browser
        d = "BrowserViewPopup";
    i?.length > 0 && (d = i);         // "QuickAccess"
    o && (d += "_uid" + o);           // becomes "QuickAccess_uid2"
    const u = { parentPopupBrowserID: o, strVROverlayKey: n, strName: d };
    let { strCreateURL: m, browserView: p } = SteamClient.BrowserView.CreatePopup(u);
    let A = window.open(m, d, /* ... */);   // the QAM's own window
}
```

So there are two windows, and each one gets its own copy of Steam's focus provider, which is the code that decides what your D-pad and buttons control. This is where every focus change enters Steam's JavaScript:

```js
// library.js: attached to both windows
function m(e) {
    const { ownerWindow: t, context: r } = e,
          n = a.useMemo(() => () => r.OnActivate(t),   [r, t]),
          i = a.useMemo(() => () => r.OnDeactivate(t), [r, t]);
    (0, s.l6)(t, "focus", n);    // window gained focus -> OnActivate
    (0, s.l6)(t, "blur",  i);    // window lost focus   -> OnDeactivate
    // (also touchstart, mousedown and focusin, all -> OnActivate)
}
```

Pressing the QAM button only flips a value in the Steam menu store. Everything after that is React reacting to it, and three native calls go out within about 2 milliseconds of each other. First, the view's host shows the view:

```js
// chunk~2dcc5aaf7.js: runs when the QAM becomes visible
n.useLayoutEffect(() => {
    if (t) {
        A();                          // SetWindowStackingOrder
        e.SetVisible(true);           // show the QAM's view
        return () => e.SetVisible(false);
    }
}, [t, r, e, A]);
```

Then the navigation tree for QAM activates, and its callback gives the view focus:

```js
// chunk~2dcc5aaf7.js: the QAM's focus helpers
fnOnFocusNavActivated: s.useCallback(() => {
    t?.GetBrowserView().SetFocus(true);   // the QAM's view takes focus
    p();
    o.ToggleSideMenu(e, true);
}, [o, e, t, p]),
```

And Game Mode's main window gives up key focus. Steam has exactly one place that does that, which is a coordinator it has on `window.g_WindowFocusCoordinator`, and these are the only `SetKeyFocus` calls anywhere in the Steam interface:

```js
// chunk~2dcc5aaf7.js
function _(e) { const t = e.ownerWindow ?? window; t.SteamClient.Window.SetKeyFocus(true);  }  // main window takes key focus
function f(e) { const t = e.ownerWindow ?? window; t.SteamClient.Window.SetKeyFocus(false); }  // main window gives it up

SetBrowserViewFocus(e, t) {
    const r = this.FindTree(t);
    r && (r.browser = e, f(r.browserContext));   // main window lets go
    e.SetFocus(true);                            // the view takes it
}
```

From there it's all native. On a normal open, the Game Mode window jumps between focus and blur 2 to 4 times over the next 18 to 50 ms, then the QAM's window grabs focus around 40 to 60 ms in, and that's it: somewhere between 5 and 16 focus changes in total, each one going through the listeners above.

The freeze happens when that bounce doesn't stop. Either the QAM's focus lands right in the middle of Game Mode's bounce, or the bounce just keeps going and the QAM joining in afterwards doesn't settle it. From then on the two windows take focus from each other every 1 to 3 ms in an infinite death-loop. None of it comes from JavaScript. In fact, every one of those events arrives with nothing on the stack but the listener itself. Every one of them runs this:

```js
// chunk~2dcc5aaf7.js: Steam's focus context
OnDeactivate(e) {                        // a window blurred
    this.m_activeWindow == e
        ? this.SetActive(false, e)
        : Re(`... Blurred, but not deactivating because (${this.m_activeWindow?.name}) has focus.`);
}
OnActivate(e) {                          // a window got focus
    this.BIsActive() && this.m_activeWindow == e && this.m_activeBrowserView === undefined
        || this.SetActive(true, e);      // anything else re-activates
}
SetActive(e, t, r = undefined) {
    this.m_controller.BatchedUpdate(() => {
        // ...
        e ? (this.m_activeWindow = t, this.m_controller.OnContextActivated(this))
          : this.m_controller.OnContextDeactivated(this, false);
        this.m_valueIsActive.Set(e);     // observable: everything watching focus re-renders
        // ...
    });
}
```

Because the active window really does change on every flip, `SetActive` really does run every time, and everything watching focus re-renders, including the focus ring, which sets React state in a layout effect each time the active tree flips. Hundreds of times a second in an indefinite loop, those updates accumulate until React hits the limit and throws:

```js
// libraries/libraries~00299a408.js: React's nested-update guard
function In(e) {
    if (50 < Nu) throw Nu = 0, Iu = null, Error(a(185));   // "Maximum update depth exceeded"
}
```

By then the page's main thread is occupied spending all of its time reacting to flips, so it no longer is responsive to anything else, controller input included, and then Steam's log goes completely silent. Both times I paused Steam's interface during one of these freezes, it was sitting in that `blur` listener, on `r.OnDeactivate(t)`.

I tried a lot of ways to stop the race from starting. For example, restricting Steam's reactions to the flips (the flips kept going at about 1.6 per millisecond, 8,209 in five seconds, and the UI hung anyway), changing the order of the three calls, giving focus back before the menu reopens. None of it helped, because the flipping happens below the JavaScript level, which is out of my control. What did work was taking one of the two windows out of the fight, which is where Stormbreaker comes in.

### Stormbreaker

Stormbreaker listens to the same `focus` and `blur` events on both windows that Steam's own code does:

```ts
function listen(win: Window, side: Side): void {
    // side is "bpm" for Game Mode's main window, "qam" for the menu's
    const handler = () => onFocusChange(side);
    win.addEventListener("focus", handler);
    win.addEventListener("blur", handler);
}
```

Every event goes into a list that only has the last 150 ms. A clean open never gets anywhere near 30 changes in that window, and a "storm" gets to that point easily in well under 100 ms, so 30 is the trip line. Both windows have to be in the list too, since a burst on one side alone is something else:

```ts
const STORM_EVENTS = 30;       // a clean open makes 5-16 changes in total
const STORM_WINDOW_MS = 150;   // a "storm" makes one every 1-3 ms and rapidly balloons

function onFocusChange(side: Side): void {
    const now = performance.now();
    recent.push({ at: now, side });
    // drop anything older than 150 ms
    while (recent.length > 0 && now - recent[0].at > STORM_WINDOW_MS) {
        recent.shift();
    }
    if (recent.length < STORM_EVENTS) {
        return;
    }
    if (recent.some((e) => e.side === "bpm") && recent.some((e) => e.side === "qam")) {
        startBreak(now);
    }
}
```

When it trips, Stormbreaker hides the QAM's browser view for a fraction of a second. There isn't anything in Steam's stores pointing at that view; QAM's React component has it in its own state, so Stormbreaker finds it by starting at the element the view renders into and walking up React's tree until it reaches the hook that holds it. If the menu was already closing, or the view can't be found, it logs that and does nothing:

```ts
function startBreak(now: number): void {
    if (!quickAccessIsOpen()) {
        return;                          // menu closed, leave it alone
    }
    const view = findQamView();          // the QAM's native browser view
    view?.SetVisible(false);             // take one side out of the fight
    if (!view) {
        return;                          // Steam changed, fail safe
    }
    breaking = { view, hiddenAt: now, events: 0 };
    // a timer to notice the quiet once the flips stop
    checkTimer = window.setInterval(() => checkBreak(performance.now()), CHECK_MS);
}
```

With the view hidden, the flips die down on their own and the "storm" is broken up, which usually takes 250 to 650 ms after the hide. Timers barely get a chance to run while a storm is going, so every event involving focus also checks whether it's over, and the timer is what notices the silence once they stop. After 100 ms with no changes, it is determined safe and that the storm has ended, so Stormbreaker shows the view again and hands it focus. If it's still going after three seconds it gives up and decides to show it anyway. Also, if you closed the menu in the meantime the view stays hidden, since Steam shows it again on the next open:

```ts
const QUIET_MS = 100;
const GIVE_UP_MS = 3000;    // the longest observed storm ran about 2.5 s

function checkBreak(now: number): void {
    const quiet = now - lastEvent >= QUIET_MS && now - breaking.hiddenAt >= QUIET_MS;
    if (quiet || now - breaking.hiddenAt >= GIVE_UP_MS) {
        finishBreak(quiet);
    }
}

function finishBreak(stopped: boolean): void {
    if (quickAccessIsOpen()) {
        view.SetVisible(true);    // bring the menu back
        view.SetFocus(true);      // and give it focus again
    }
    // short re-arm after a storm that stopped, so a second one right behind it
    // is caught; long after one that didn't, so it isn't hidden over and over
    rearmAt = now + (stopped ? REARM_AFTER_STOP_MS : REARM_MS);
}
```

The good news is, showing the view again doesn't restart the storm. On the Steam Deck OLED for example, hiding it stopped 12 out of 12 storms in about 200 ms in the preliminary tests, with the menu still open and nothing lost, while the same test with Stormbreaker off froze and needed a restart. In all of the tests since then, Stormbreaker had a 100% "stormbreaking" success rate. Each storm it breaks is recorded and sent to the Logs tab which details how many focus changes tripped it, how many more after the hiding of the view, and how long the view was hidden. In most cases, the view was hidden for a tiny fraction of a second, so all the user sees (or may not even notice it) is a brief flash or blink.

### Automatic Recovery

Automatic Recovery is the safety net or fallback for anything that gets past Stormbreaker (if that's even possible), or any other freeze of the Steam UI. It's a small service in the plugin's backend that connects to the Steam UI over the Chrome DevTools Protocol and pings it every two seconds with the smallest possible piece of JavaScript:

```python
PING_INTERVAL = 2.0
PING_TIMEOUT = 3.0


def ping(conn):
    # has to run on the UI's main thread, which is exactly what a freeze stops
    return conn.send("Runtime.evaluate", {"expression": "1", "returnByValue": True})
```

Think of it as a wellness check. If a ping doesn't answer back, usually something is wrong. As long as the answer comes back, it does nothing else at all, so the assumption is it is healthy. Once a ping goes 3 seconds without an answer, it starts keeping score: one point for every second of silence, plus 10 points for each sign that it really is a freeze and not just a slow moment:

```python
KILL_SCORE = 30
MIN_SILENCE = 10.0
CONFIRM_POINTS = 10

score = (
    int(silence)  # 1 point per silent second
    + (CONFIRM_POINTS if fresh_connection_failed else 0)  # a brand-new connection gets no answer either
    + (CONFIRM_POINTS if cpu_hit else 0)  # a steamwebhelper process is pinned near a full core
    + (CONFIRM_POINTS if memory_hit else 0)  # one has grown by 200 MB or more
    + (CONFIRM_POINTS if focus_hit else 0)  # Steam's log is filling with "already selected tab" lines
)

if score >= KILL_SCORE and silence >= MIN_SILENCE:
    recover()
```

As you can see, these are all symptoms of the `steamwebhelper` being hung up. A focus storm suffocates a `steamwebhelper` process and a fresh connection gets no answer either, so it usually reaches 30 by the 10-second mark, which is why recovery acts within 10 to 15 seconds after the freeze. A freeze with no other signs requires the full 30 seconds of silence. The last sign is for a different QAM freeze, a known rapid-toggle one ([steam-for-linux #12314](https://github.com/ValveSoftware/steam-for-linux/issues/12314)), which populates the Steam log with `Trying to change focus to already selected tab` instead of going silent.

Recovering means killing every `steamwebhelper` process, which is what handles the Steam interface. It's pretty harmless, as Steam notices this and starts it back up within a few seconds. If you were playing a game during this process, it's not a problem as it will still be running, where all you have to do is **Resume** it from the game page.

```python
def kill_steamwebhelper():
    for entry in os.listdir("/proc"):
        if entry.isdigit() and comm_of(entry) == "steamwebhelper":
            os.kill(int(entry), signal.SIGKILL)
```

Restarting the Steam UI is a serious event, so there are a few safety mechanisms I've added for it. A freshly restarted interface gets a whole minute to come back up before it can be judged, and waking the device from sleep gets 20 seconds. After a recovery, Steam has to answer every ping for 30 seconds before another auto-recovery is allowed. In addition, if there are four auto-recoveries in 30 minutes, the watchdog stops killing until the plugin reloads, so it can't go into an infinite loop if there is ever a problem it cannot fix. With **Save Recovery Logs** on, it also pauses the Steam UI just before the restart and saves what it was running, checking it against the known freeze (the `OnDeactivate` blur handler above).

## Features

- **Stormbreaker**: Stops a rare SteamOS freeze that can start as the Quick Access Menu opens. When one begins, the menu blinks once and carries on instead of Steam's interface freezing. It only acts during that moment and changes no Steam code.

- **Automatic Recovery**: SteamOS has a known bug where the Quick Access Menu can freeze on screen or get stuck after being opened and closed quickly. Enabling this will turn on the watchdog service which will detect this situation and free you from being stuck—usually 10–15 seconds from the freeze. The Steam interface will be reset without shutting off your game, but it will move you back to the game launch screen where all you have to do is resume it and you are exactly where you left off.

- **Save Recovery Logs**: Saves a record of each recovery to the plugin's log folder, including what Steam's interface was doing when it froze, and writes detailed recovery activity to the plugin log. Useful when reporting a problem. Steam does a little more work while this is on, so leave it off otherwise.

- **Clear Recovery Logs**: Deletes every saved recovery record from the plugin's log folder. Only clears the extended recovery logs. Your other logs (in the logs tab) are rotated at 200 max events.

- **Track Events**: In the logs tab, view QAM freeze events and stats such as if it was prevented or recovered from, as well as focus-related data.

## Requirements

- Any device with **SteamOS** is required to run the plugin (Steam Deck, Steam Machine, Asus ROG Ally, custom installation, etc.)

- **Decky Loader** is also required to be installed on your SteamOS device.

[Get Decky Loader Here](https://github.com/SteamDeckHomebrew/decky-loader)

## Installation

1. Enter **Desktop Mode** and download the latest version of Stormbreaker from the [Releases page](https://github.com/FAILINATOR5000/decky-stormbreaker/releases). Place the ZIP file in an easy-to-access location such as desktop or downloads.

2. Go into **Game Mode** and open the **Quick Access Menu** (The ... button on Steam Deck or Steam Controller).

3. Select the **Decky Loader** plugin button (the one with the plug icon), and select the settings button in the upper right corner (the gear icon).

4. Under the **General** tab, toggle **Enable Developer Mode** on. The **Developer** tab should now appear.

5. From the **Developer** section, select **Install Plugin from ZIP File**.

6. Select the downloaded ZIP file you had downloaded in the first step.

7. Congratulations! Stormbreaker is now installed!

## Updating Stormbreaker

Stormbreaker makes updating an incredibly easy process. Whenever there is an update available, you will be notified of the update with a pop-up notification. To begin the update process, open **Stormbreaker** from the **Decky Loader** plugins list, where an **Update Available** section will be waiting for you at the top of the **Status** tab.

1. In the Update Available section, you have two options: You can either copy the URL link for the update or add the updater to your desktop (see below). In this case, it's recommended and much easier to just copy the URL link by selecting **Copy Install Link**.

2. Once copied, exit the Stormbreaker plugin by selecting the back arrow (←) at the top of the page. You will now be within the **Decky Loader** plugins list.

3. While here, select the settings button in the upper right corner (the gear icon) and then ensure **Developer Mode** is enabled in the **General** settings tab. (It should be from when you installed Stormbreaker)

4. Select the **Developer** tab. Select the field under **Install Plugin from URL**, paste your copied URL (Use the **Paste** button in the lower right corner of the on-screen keyboard), and then select **Install**.

5. The update for Stormbreaker will now be installed. All of your settings and logs stay intact and nothing is touched during the update process, so you can jump right back into your game with no issues.

I would also like to mention, while Stormbreaker does check for updates and notifies you automatically, it does it in 12-hour ticks. You will only be notified once per update, but the **Update Available** section stays on the **Status** tab until you install it.

**Prefer to update from Desktop Mode?** Stormbreaker can put a simple, double-click updater on your desktop. When an update is available, select **Add Updater to Desktop** in the **Update Available** section. Head into Desktop Mode, double-click **Update Stormbreaker**, and enter your password when it asks. It fetches the newest release, swaps it in, and restarts Decky for you. Your data is left alone, exactly as with the steps above. It can install Stormbreaker from scratch too, so it's handy if you ever need to reinstall.

## Troubleshooting

### CheevoDeck has this feature too. Is this compatible with it?

Yes, it's compatible. When you have features turned on for **Stormbreaker**, **CheevoDeck** yields to it to avoid conflicts. If you disable the features in this plugin, but leave them on in CheevoDeck, only then will it work within that plugin.

## Motivation

I'm a huge SteamOS power-user, and I often open and close the Quick Access Menu a lot when testing my plugins, so I have run into the dreaded QAM getting stuck error where I had to either reset or ssh in from my other device and pkill steamwebhelper. While rare, it is very disruptive and progress in my games has been lost in the process. This issue has occurred without Decky Loader installed, as well as with it installed across a plethora of different plugins. Also, my main plugin, **[CheevoDeck](https://github.com/FAILINATOR5000/decky-cheevodeck)**, was another large motivation. I want users to have the best experience possible with no interruptions, so I sought to learn more about this issue and build something that actually prevents it.

## Author & Support

Stormbreaker is written by Jameson (FAILINATOR5000).

Have any cool ideas you'd like to see implemented? Or just have questions, need help, or have bug reports? You can contact me via email at [FAILINATOR5000@proton.me](mailto:FAILINATOR5000@proton.me).

## License

BSD 3-Clause. The full text is in [LICENSE](LICENSE), and the licenses for third-party components are in [THIRD-PARTY-LICENSES](THIRD-PARTY-LICENSES).

## Disclaimer

Stormbreaker is not affiliated with or endorsed by Steam, Valve, or Decky Loader.
