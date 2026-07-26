# AfterMeet Capture extension

Capture people from LinkedIn (and other pages) into AfterMeet without server-side scraping.

## Install locally

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this `extension/` folder

## Use

1. Set your AfterMeet URL in the popup (`http://localhost:3000` for local dev)
2. Open a LinkedIn profile (`linkedin.com/in/...`)
3. Click the extension icon → **Capture this page**
4. Review the imported details in AfterMeet → save to People

## Notes

- The extension only reads what is visible in your browser tab.
- Email and phone appear only when LinkedIn shows them to you.
- AI cleanup runs when you are signed into AfterMeet and AI Gateway is configured.

## Production

Set the popup base URL to your deployed app, for example `https://aftermeet-beta.vercel.app`.
