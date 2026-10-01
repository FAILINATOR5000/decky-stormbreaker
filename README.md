Stormbreaker is a Decky Loader plugin for SteamOS platforms that both prevents and recovers you from a rare SteamOS bug related to the Quick Access Menu (QAM), where in rare cases upon opening, it gets stuck and becomes unresponsive. While rare, it is devastating as controls also become unresponsive, so usually it results in hard resetting the device, losing game progress in the process.

## Table of Contents

- [How It Works](#how-it-works)
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

The Quick Access Menu (QAM) is a little window sitting on top of Big Picture (Game Mode). When it opens, Steam tells Big Picture to release the focus and delegates it to the menu, all within a couple of milliseconds. Most of the time the two sort it out in a fraction of a second. But occasionally, the timing lands just wrong and they both grasp for focus at the same time. When this happens, the chaos begins, and instead of one of them winning they start passing it back and forth, hundreds of times a second. Memory starts to balloon and CPU usage remains high. Steam's interface tries to react to every single one of those handoffs, so it gets buried and overwhelmed, stops listening to your button input, and locks up with the game running behind it. It's really quite devastating when you've built up progress and this happens. While rare, it seems to occur more often when running a heavy game in the background, but it can occur in lightweight situations as well.

This is where **Stormbreaker** comes in. It watches for that back and forth, and the moment it sees it, it hides the menu's page for a split second. With one side out of the fight it ends almost instantly, usually in under a second, and then the page comes right back. All you see is a blink, and the best part is you don't lose your progress. I've also added a fallback service called "Automatic Recovery". So if Stormbreaker fails, which my current tests show it shouldn't, Automatic Recovery notices Steam's interface has stopped responding and restarts steamwebhelper, giving control back to you. Once you get the control back and the interface resets, your game will still be running in the background safely, where all you have to do is select resume for your game to jump right back in.

All you have to do is install **Stormbreaker** and it protects you globally. It doesn't matter which plugins you are using or which menu you are in when you open the QAM; you will be protected when it does happen. It runs silently in the background and uses nearly no CPU, merely monitoring the QAM as it opens, as well as steamwebhelper to determine if it is unresponsive from a freeze so that it can recover you from it.

## Features

- **Stormbreaker**: Stops a rare SteamOS freeze that can start as the Quick Access Menu opens. When one begins, the menu blinks once and carries on instead of Steam's interface freezing. It only acts during that moment and changes no Steam code.

- **Automatic Recovery**: SteamOS has a known bug where the Quick Access Menu can freeze on screen or get stuck after being opened and closed quickly. Enabling this will turn on the watchdog service which will detect this situation and free you from being stuck—usually in about 10 seconds from the freeze. The Steam interface will be reset without shutting off your game, but it will move you back to the game launch screen where all you have to do is resume it and you are exactly where you left off.

- **Save Recovery Logs**: Saves a record of each recovery to the plugin's log folder, including what Steam's interface was doing when it froze, and writes detailed recovery activity to the plugin log. Useful when reporting a problem. Steam does a little more work while this is on, so leave it off otherwise.

- **Clear Recovery Logs**: Deletes every saved recovery record from the plugin's log folder.

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

Follow the [Installation](#installation) instructions with the latest release.

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
