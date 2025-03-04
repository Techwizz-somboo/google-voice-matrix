const config = require('./config.js');
const botNotifyRoom = `${config.matrixBotId.split(':')[0]}-Notify2`
const [Black, Red, Green, Yellow, Blue, Magenta, Cyan, White] = ["\x1b[30m", "\x1b[31m", "\x1b[32m", "\x1b[33m", "\x1b[34m", "\x1b[35m", "\x1b[36m", "\x1b[37m"]
const JP = (text) => JSON.stringify(text, null, 2) // JSON prettify
const Log = (text, color = White) => {
   if (config.logging && (config.imapNoopLogging || !text.includes('NOOP'))) {
      let timestamp = new Date((datetime = new Date()).getTime() - datetime.getTimezoneOffset() * 60000).toISOString()
         .replace("T", " ").split('.')[0]
      console.log(`${timestamp} ${color}${text}${White}`);
   }
}

//! Replies via gmail-send

const gVoiceReply = async (room, text) => {
   let alias = await matrixClient.getPublishedAlias(room);
   let subject = await matrixClient.getRoomStateEvent(room, 'm.room.topic')
   if (typeof alias != 'undefined' && alias.includes('@txt.voice.google.com')) {
      let data = {
         user: config.gmailId, pass: config.gmailPw,
         to: alias.split(/[#:]+/)[1],
         subject: subject, text: text
      };
      Log(`GMAIL (OUT): "${text}" to ${data.to.split('.')[0]}`, Magenta);
      require('gmail-send')(data)(() => { });
   }
}

//! Upload & share media to Nextcloud

const nextcloudUpload = async (fileName, mediaData) => {
   try {
      const nextcloudUrl = config.nextcloudInstance;
      const uploadsDir = config.nextcloudFolder;
      const username = config.nextcloudUsername;
      const password = config.nextcloudPassword;
      const credentials = Buffer.from(`${username}:${password}`).toString('base64');

      const unixTime = Math.floor(Date.now() / 1000);
      const fileNameUpload = `${unixTime}_${fileName}`

      const propfind = await fetch(`${nextcloudUrl}/remote.php/dav/files/${username}/${uploadsDir}`, {
         method: 'PROPFIND',
         headers: {
             'Authorization': `Basic ${credentials}`,
             'Depth': '1'
         }
      });

      if (!propfind.ok) {
         // Create the folder
         const createFolder = await fetch(`${nextcloudUrl}/remote.php/dav/files/${username}/${uploadsDir}`, {
            method: 'MKCOL',
            headers: {
                'Authorization': `Basic ${credentials}`
            }
         });

         if (!createFolder.ok) {
            Log(`Nextcloud: Failed to create folder ${uploadsDir}.`, Red);
            throw new Error(`Error: ${createFolder.status} ${createFolder.statusText}`);
         }
      }

      // Upload the file
      const uploadFile = await fetch(`${nextcloudUrl}/remote.php/dav/files/${username}/${uploadsDir}/${fileNameUpload}`, {
         method: 'PUT',
         headers: {
            'Authorization': `Basic ${credentials}`
         },
         body: mediaData
      });

      if (!uploadFile.ok) {
         Log(`Nextcloud: Failed to upload file ${fileName}.`, Red);
         throw new Error(`Error: ${uploadFile.status} ${uploadFile.statusText}`);
      }

      // Share the file
      const shareBody = new URLSearchParams({
         path: `/${uploadsDir}/${fileNameUpload}`,
         shareType: '3', // Public link
         permissions: '1' // Read-only
      });

      const shareFile = await fetch(`${nextcloudUrl}/ocs/v1.php/apps/files_sharing/api/v1/shares`, {
         method: 'POST',
         headers: {
            'Authorization': `Basic ${credentials}`,
            'Accept': 'application/json',
            'OCS-APIRequest': 'true',
            'Content-Type': 'application/x-www-form-urlencoded'
         },
         body: shareBody
      });

      if (!shareFile.ok) {
         Log(`Nextcloud: Failed to share ${fileNameUpload}.`, Red);
         throw new Error(`Error: ${shareFile.status} ${shareFile.statusText}`);
      }

      // Parse for the share link.
      const shareText = await shareFile.text();
      const shareJson = JSON.parse(shareText);
      
      return shareJson.ocs.data.url;
   } catch (error) {
      Log(`Nextcloud upload error: ${error}`, Red);
   }
}

//! Matrix via matrix-bot-sdk

const { MatrixClient, SimpleFsStorageProvider, AutojoinRoomsMixin } = require("matrix-bot-sdk")
const storage = new SimpleFsStorageProvider("bot.json")


const matrixSendMessage = async (from, data) => {

   const getRoom = (alias) => { return matrixClient.resolveRoom(alias).catch((e) => { return e.statusCode }) }

   const createRoom = (name, alias) => {
      return matrixClient.createRoom({
         name: name.replace(/$| \(SMS\)/, ' (GV)'),
         invite: config.matrixYourIds,
         is_direct: true,
         room_alias_name: alias,
         topic: `Google Voice bridge with ${name}`,
         preset: "trusted_private_chat"
         //, power_level_content_override: { users_default: 100 }
      }).catch((e) => { return e.statusCode })
   };

   var room = await getRoom(`#${from.address}:${config.matrixDomain}`);
   if (room > 0) { // create room if doesn't already exist (because got status code so room > 0)
      room = await createRoom(from.name, from.address);
      await matrixClient.sendStateEvent(room, 'm.room.member', config.matrixBotId, { displayname: from.name, membership: 'join' })
      if (config.roomAvatarURL) {
         await matrixClient.sendStateEvent(room, 'm.room.avatar', '', {
            url: config.roomAvatarURL //set room avatar google voice
         });
      }
   }

   Log(`MATRIX (OUT): ${JP({ room, data })}`, Blue)
   matrixClient.sendMessage(room, data);
}

const matrixNotify = (text, color, emoji = '🤖') => {
   matrixSendMessage({ address: `${botNotifyRoom}`, name: config.matrixBotName },
      {
         body: body = `${emoji} <code>${text}</code>`,
         formatted_body: body, msgtype: 'm.notice', format: "org.matrix.custom.html"
      });
   Log(text, color);
}

const getAvatarUrl = async (url) => {
   let mxcURL = '';
   if (url.startsWith('mxc://')) { mxcURL = url }
   else if (url.startsWith('http')) {
      mxcURL = await matrixClient.uploadContentFromUrl(url)
   }
   return mxcURL
}

const setRoomAvatar = async (roomId, url) => {
   let mxcURL = await getAvatarUrl(url);
   if (mxcURL) {
      await matrixClient.sendStateEvent(roomId, 'm.room.avatar', '', { url: mxcURL }); // room avatar
      await matrixClient.sendStateEvent(roomId, 'm.room.member', config.matrixBotId, { avatar_url: mxcURL, membership: "join" }); // bot room avatar
   }
}

var matrixClient;
const startNewMatrixClient = () => {
   matrixClient = new MatrixClient(config.matrixServerUrl, config.matrixBotAccessToken, storage);
   AutojoinRoomsMixin.setupOnClient(matrixClient);

   matrixClient.start().then(() => { matrixNotify("MATRIX: connected.", Green, '🟢'); });

   const ONE_HOUR_MS = 60 * 60 * 1000;

   matrixClient.on("room.message", async (room, event) => {
      if (!event.content) return;

      const currentTime = Date.now();
      const eventTime = event.origin_server_ts;

      if (currentTime - eventTime > ONE_HOUR_MS)  {
         Log(`Warning: Message older than 1 hour, ignoring: ${event.content.body}`, Yellow);
         return;
      }

      let sender = event.sender;
      let body = event.content.body;
      let contentType = event.content.msgtype;

      if (sender != config.matrixBotId && event.type == 'm.room.message' && contentType == 'm.text') {
         Log(`MATRIX (IN): ${JP(event)}`, Blue);
         if (body.startsWith('!')) {
            let [cmd, arg = ''] = body.split(/ (.*)/g)
            if (cmd == '!help') {
               await matrixClient.sendMessage(room, {
                  body: msg =
                     '<code>!name &lt;string&gt;</code> Set room name<br>' +
                     '<code>!botname &lt;string&gt;</code> Set bot name (in all rooms)<br>' +
                     '<code>!botnick &lt;string&gt;</code> Set bot nickname (in current room)<br>' +
                     '<code>!avatar &lt;public URL&gt;</code> Set room & bot room avatar<br>' +
                     '<code>!show &lt;MXC URL&gt;</code> Display a given MXC URL<br>' +
                     '<code>!echo &lt;text&gt;</code> Check if alive<br>' +
                     '<code>!restart</code> Restart IMAP & Matrix connections<br>' +
                     '<code>!help</code> Show this list<br>',
                  msgtype: "m.text", format: "org.matrix.custom.html",
                  formatted_body: msg
               });
            }
            else if (cmd == '!avatar' && arg) {
               setRoomAvatar(room, arg)
            }
            else if (cmd == '!botname' && arg) {
               await matrixClient.setDisplayName(arg)
            }
            else if (cmd == '!botnick' && arg) {
               await matrixClient.sendStateEvent(room, 'm.room.member', config.matrixBotId, { displayname: arg, membership: 'join' })
            }
            else if (cmd == '!name' && arg) {
               await matrixClient.sendStateEvent(room, 'm.room.name', '', { name: arg })
            }
            else if (cmd == '!show' && arg) {
               await matrixClient.sendMessage(room, {
                  msgtype: "m.image",
                  url: `mxc://${config.matrixDomain}/${arg}`,
                  body: 'image'
               })
            }
            else if (cmd == "!echo") {
               await matrixClient.sendMessage(room, {
                  "msgtype": "m.notice",
                  "body": arg ? arg : 'Hi!',
               });
            }
            else if (cmd == "!restart") {
               await mailClient.stop(); //startNewMailClient();
               await matrixClient.stop(); startNewMatrixClient();
            }
         } else if (await matrixClient.getPublishedAlias(room) != `#${botNotifyRoom}:${config.matrixDomain}`) {
            gVoiceReply(room, body)
         }
      }
      else if (config.nextcloudEnabled && sender != config.matrixBotId && event.type == 'm.room.message' && (contentType == 'm.image' || contentType == 'm.file' || contentType == 'm.audio' || contentType == 'm.video')) {
         try {
            let fileName = event.content.filename;
            if (fileName == null) { fileName = event.content.body; }

            let mediaData = null;

            Log(`MATRIX (IN): Downloading media ${fileName}. Event ${JP(event)}`, Blue);

            // Attempt to use the downloadContent function, if download fails try the new authenticated endpoint.
            try {
               let mediaDownloaded = await matrixClient.downloadContent(event.content.url);
               mediaData = mediaDownloaded.data;
            } catch {
               // Parse the mxc url
               const [, rest] = event.content.url.split('mxc://');
               const parts = rest.split('/');

               const serverName = parts[0];
               const assetId = parts[parts.length - 1];

               // Fetch the asset
               const assetDownloaded = await fetch(`${config.matrixServerUrl}/_matrix/client/v1/media/download/${serverName}/${assetId}`, {
                  method: 'GET',
                  headers: {
                      'Authorization': `Bearer ${config.matrixBotAccessToken}`
                  }
               });

               if (!assetDownloaded.ok) {
                  Log(`Failed to fetch asset ${fileName}.`, Red);
                  throw new Error('Network response was not ok ' + assetDownloaded.statusText);
               }

               mediaData = await assetDownloaded.arrayBuffer();
            }

            if (mediaData == null) {
               throw new Error('mediaData is null.');
            }
            
            Log(`MATRIX (IN): Uploading media ${fileName} to Nextcloud.`, Blue);
            let fileUrl = await nextcloudUpload(fileName, mediaData);
            let messageToSend = `${config.nextcloudTextToSend} ${fileUrl}`;
            if (messageToSend.includes("Nextcloud upload error")) {
               await matrixClient.sendMessage(room, {
                  "msgtype": "m.notice",
                  "body": `${messageToSend}`,
               });
            }
            else {
               gVoiceReply(room, messageToSend);
            }
         } catch (error) {
            Log(`Error downloading or uploading media to Nextcloud. ${JP(error)}`, Red);
            await matrixClient.sendMessage(room, {
               "msgtype": "m.notice",
               "body": `Error downloading or uploading media to Nextcloud. Please check server logs.`,
            });
         }
      }

   });
}

//! INCOMING via Gmail IMAP watch from https://github.com/chirag04/mail-listener2/blob/master/index.js
const Imap = require('imap');
const EventEmitter = require('events').EventEmitter;
const simpleParser = require('mailparser').simpleParser;
const async = require('async');
const { auth } = require("googleapis/build/src/apis/abusiveexperiencereport");

class MailListener extends EventEmitter {
   constructor(options) {
      super();
      this.markSeen = !!options.markSeen;
      this.mailbox = options.mailbox || 'INBOX';
      if ('string' === typeof options.searchFilter) { this.searchFilter = [options.searchFilter] }
      else { this.searchFilter = options.searchFilter || ['UNSEEN']; };
      this.fetchUnreadOnStart = !!options.fetchUnreadOnStart;
      this.mailParserOptions = options.mailParserOptions || {};
      if (options.attachments && options.attachmentOptions && options.attachmentOptions.stream) {
         this.mailParserOptions.streamAttachments = true;
      };
      this.attachmentOptions = options.attachmentOptions || {};
      this.attachments = options.attachments || false;
      this.attachmentOptions.directory = (this.attachmentOptions.directory ? this.attachmentOptions.directory : '');
      this.imap = new Imap({
         keepalive: config.imapKeepalive,
         xoauth2: options.xoauth2, user: options.username, password: options.password, host: options.host,
         port: options.port, tls: options.tls, tlsOptions: options.tlsOptions || {},
         connTimeout: options.connTimeout || null, authTimeout: options.authTimeout || null,
         debug: options.debug || null
      });
      this.imap.once('ready', this.imapReady.bind(this));
      this.imap.once('close', this.imapClose.bind(this));
      this.imap.on('error', this.imapError.bind(this));
   }
   start() { this.imap.connect() };
   stop() { this.imap.end() };
   imapReady() {
      this.imap.openBox(this.mailbox, false, (err, mailbox) => {
         if (err) { this.emit('error', err); }
         else {
            this.emit('server', 'connected');
            this.emit('mailbox', mailbox);
            if (this.fetchUnreadOnStart) { this.parseUnread.call(this); }
            let listener = this.imapMail.bind(this);
            this.imap.on('mail', listener);
            this.imap.on('update', listener);
         }
      });
   };
   imapClose() { this.emit('server', 'disconnected'); };
   imapError(err) { this.emit('error', err); };
   imapMail() { this.parseUnread.call(this); };
   parseUnread() {
      let self = this;
      self.imap.search(self.searchFilter, (err, results) => {
         if (err) { self.emit('error', err); }
         else if (results.length > 0) {
            async.each(results, (result, callback) => {
               let f = self.imap.fetch(result, { bodies: '', markSeen: self.markSeen });
               f.on('message', (msg, seqno) => {
                  msg.on('body', async (stream, info) => {
                     let parsed = await simpleParser(stream);
                     // console.log("MAIL:", parsed);
                     let from = parsed.from.value[0];
                     self.emit('mail', from, parsed.text, parsed.subject);
                     if (parsed.attachments.length > 0) {
                        for (let att of parsed.attachments) {
                           if (self.attachments) { self.emit('attachment', from, att); }
                           else { self.emit('attachment', from, null); }
                        }
                     }
                  });
               });
               f.once('error', (err) => { self.emit('error', err); });
            }, (err) => { if (err) { self.emit('error', err); } });
         }
      });
   }
}

var mailClient;

const startNewMailClient = () => {
   mailClient = new MailListener({
      username: config.gmailId, password: config.gmailPw, host: 'imap.gmail.com',
      port: 993, tls: true, tlsOptions: { servername: 'imap.gmail.com' },
      connTimeout: 10000, authTimeout: 5000,
      mailbox: "INBOX",
      searchFilter: [
         ['UNSEEN'],
         ['or', ['FROM', 'txt.voice.google.com'], ['FROM', 'voice-noreply@google.com']],
         ["SINCE", new Date().getTime() - 86400000 * config.backDays]
      ],
      // searchFilter: [['FROM', 'txt.voice.google.com'], ["SINCE", new Date().getTime()-24*60*60*1000*10]],  // for testing
      fetchUnreadOnStart: true, markSeen: true,
      attachments: true, attachmentOptions: { directory: "attachments/" },
      debug: config.imapLogging ? Log : false
   });

   mailClient.start();

   mailClient.on("mail", async (from, text, subject) => {
      Log(`GMAIL (in): ${JP({ text, from, subject })}`, Red);
      let data = { msgtype: 'm.text' }
      let bodytxt = text.replace(/.*<https:\/\/voice\.google\.com>/im, '').replace(/(To respond to this text message, reply to this email or visit Google Voice|YOUR ACCOUNT <https:\/\/voice\.google\.com>)(.|\n)*/m, '').replace(/Hello.*\n/, '').trim()
      if (from.address.startsWith('voice-noreply@google.com')) {
         from = {
            address: `${botNotifyRoom}`,
            name: config.matrixBotName
         }
         bodytxt = `${subject}\n\n${body}`
         // bodytxt = `<h5>${subject}</h5>${body}`
         data.formatted_body = `<h5>${subject}</h5>` + body.replace('\n\n', '<br>').replace(/^(.*)\n<(http.*)>/gm, '<br>🔗 <code><a href="$2">$1</a></code>').trim()
         data.format = "org.matrix.custom.html";
      }
      data.body = bodytxt.replace(/([a-z])\n/g, '$1 ')
      // console.log("MSG: ", Magenta, data, White)
      matrixSendMessage(from, data)
   })

   mailClient.on("server", async (status) => {
      if (status == 'connected') {
         matrixNotify(`GMAIL: ${status}`, Magenta, '🟢');
      } else if (status == 'disconnected') {
         matrixNotify('GMAIL: disconnected, attempting reconnection in 10s...', Red, '🔴');
         setTimeout(startNewMailClient, 1000 * 10);
      } else { matrixNotify(`GMAIL: ${status}`, Magenta) }
   });

   mailClient.on("error", (err) => {
      matrixNotify(`GMAIL ${err}\nAttempting reconnection in 10s...`, Yellow, '⚠️');
      mailClient.stop(); 
      // setTimeout(startNewMailClient, 1000 * 10);
   });

   mailClient.on("attachment", async (from, att) => {
      Log(`GMAIL (IN) Attachment: ${JP({ size: att.size, contentType: att.contentType })}`, Red)
      if (att) {
         let name = `attachment.${att.contentType.split('/')[1]}`;
         let url = await matrixClient.uploadContent(Buffer.from(att.content, 'base64'), att.contentType, name);
         matrixSendMessage(from, {
            msgtype: "m.image", url: url, body: name
         });
      }
   });

}

startNewMatrixClient();
startNewMailClient();

// 2022 04 19 1056
