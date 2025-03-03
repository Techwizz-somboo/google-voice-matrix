# Google Voice & Matrix Bridge Bot

Google-Voice-Matrix is an open-source and self-hostable bridge bot to integrate between [Google Voice](https://voice.google.com/about) and [Matrix](https://matrix.org/).

Google Voice offers no API, so the way this bridge bot works is a little unique. It makes use of Google's email forwarding feature to give a reliable way to integrate with Google Voice. This, however, does come with caveats. For example, Google doesn't allow sending MMS messages through the email integration. I, however, have worked around this by offering a Nextcloud integration. When you attempt to send media through Matrix, the bridge will automatically upload the media to any Nextcloud instance of your choice and instead send the recipient a link to the media. This comes with some benefits, one being that there's no compression, meaning images will be sent at full quality. It also means you can easily send files, videos, audio and music in addition to images, which Google Voice doesn't even natively support. Another caveat of using the email forwarding feature as a bridge is that it's impossible to get messages you send directly through Google Voice, meaning if you send a message directly through Google Voice, either through the mobile app or web interface, the message will not appear in Matrix.

### Tldr; How this works

*   Use Google Voice’s **Forward messages to email** option and watch inbox for new messages, then create new rooms for each sender
*   Watch these rooms for replies and route back through Gmail to Google Voice.

### Supported:

*   Text messages, incoming & outgoing (replies)
*   Incoming media (images, etc.)
*   Outgoing media (through our Nextcloud Integration, although not possible to send as an MMS)

### Not supported:

*   Group chats (Google doesn't forward group chat messages to email)

### Planned:

*   Automatically grab avatars for contacts from your Gmail Contacts.

## Setup

1.  In **Google Voice > Settings > Messages,** make sure **Forward messages to email** is ON.
2.  Create a new account for your bot on your any Matrix server (e.g., matrix.org or a homeserver), then get the bot's `access_token`. (The simplest way to do this is using [Element](https://element.io/). Instructions [here](https://t2bot.io/docs/access_tokens/).)
3.  You must send the replies _from your own Gmail account_, so this requires authenticating your Gmail. So generate an **App Password** for Gmail. (Instructions [here](https://support.google.com/accounts/answer/185833).)
4.  You can run this bot on any machine with Internet and `node` – your homeserver, laptop, Pi, whatever. 
5.  On the machine where this bot will run:
    -  `git clone https://github.com/dzg/matrix-googlevoice`
    -  `npm install`
    -  `cp config.example.js config.js`
    -  Edit `config.js` with your parameters. See comments there for more info.
    -  Run `node matrix-googlevoice-bot.js` 
    -  Set it up to always run using your preferred method.

#### Notes

*   If you "leave" the room created by the bot, you might not be able to rejoin, and later you will not be able to receive messages from the same sender, because the room alias will still be reserved, which would require manually deleting the old alias.
*   Feel free to change the Room Topic, Name, or Avatar – but do _not_ delete the Alias.

## Extras

Some other things the bot can do:

*   `!name <string>` Set room name
*   `!botname <string>` Set bot name (in all rooms)
*   `!botnick <string>` Set bot nickname (in current room)
*   `!avatar <mxc or http URL>` Set room & bot room avatar to linked image (like a photo of the contact.) Example: 
    `!avatar https://play-lh.googleusercontent.com/Gf8ufuFbtfXO5Y6JuZjnG0iIpZh21zNTqZ5aiAXO8mA38mvXzY-1s27FWbGlp51paQ`
*   `!show <mxc URL>` Display content of an MXC URL
*   `!restart` Restart IMAP & Matrix connections
*   `!echo <text>` Check if alive

## To do

*   Automatically search Google Contacts API for avatars
*   Add options for logging
*   A command to change the message to send with the Nextcloud link when sending media
*   Offer an easy way to rejoin rooms

## Credits

Maintainer: [Paul Black @Techwizz-somboo](https://github.com/Techwizz-somboo). Paul added the Nextcloud integration, bug fixes, and plans to integrate the Google Contacts API, along with other features. You can support him and his work on [Liberapay](https://liberapay.com/Techwizz/).

This bridge originates from [matrix-googlevoice](https://github.com/dzg/matrix-googlevoice) created by [Ze’ev @dzg](https://github.com/dzg). If you'd like to support them, here's their [Ko-fi](https://ko-fi.com/dzeevg).
