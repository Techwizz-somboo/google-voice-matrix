module.exports = {

   // Following MUST be edited:
   matrixBotId: '@yourbot:matrix.org', // The user ID of the account you set up to use as the bot
   matrixBotAccessToken: "syt_abcdefghijklmnopqrsutwxyz123456789", // Instructions at https://t2bot.io/docs/access_tokens/
   gmailId: 'you@gmail.com', // Your Gmail ID
   gmailPw: 'abcdefghijklmnop', // Use an App Password, see https://support.google.com/accounts/answer/185833
   matrixYourIds: ['@you:beeper.com'], // Array of users to invite to new rooms created by the bot. Can be on any server.

   // Following are set up for use with a bot account at matrix.org. Edit if using another server.
   matrixServerUrl: `https://matrix-client.matrix.org`,
   matrixDomain: 'matrix.org',

   // Following are optional
   matrixBotName: 'Google Voice Bot',
   roomAvatarURL: 'mxc://matrix.org/ShLVOQjbDdUbugMrjhSaBaoB', // Avatar for all new GV bridged rooms
   backDays: 0, // Days back to search for messages in Gmail. Mark messages as Unread if you want the bot to see them.
   logging: true, // Log to console?

   // Nextcloud Integration, Required if you want to be able to send images, or other media out of the bridge
   nextcloudEnabled: false, // Turn to true if you want Nextcloud integration.
   nextcloudInstance: 'https://my.nextcloud.com', // Change to your Nextcloud instance.
   nextcloudUsername: 'user', // Set this to your Nextcloud username.
   nextcloudPassword: 'pass', // Set this to your Nextcloud password or app password.
   nextcloudFolder: 'matrix-google-voice', // This is the folder media will be uploaded to.
   nextcloudTextToSend: 'I shared a file with you.', // This is the text that'll send with the link to your file.

   // Following are tweaks for the IMAP client; see https://github.com/mscdex/node-imap
   imapKeepalive: {
      interval: 60 * 1000, // interval (in ms) at which NOOPs are sent and the interval at which idleInterval is checked. Default 10000
      idleInterval: 5 * 60 * 1000, // interval (in ms) at which an IDLE command (for servers that support IDLE) is re-sent. Default 300000 (5 mins)
      forceNoop: true // Set to true to force use of NOOP keepalive on servers also support IDLE. Default false
   },
   imapLogging: true, // Log IMAP events to console?
   imapNoopLogging: false, // Log IMAP NOOP to console?
}
