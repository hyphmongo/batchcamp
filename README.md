[<img src="https://user-images.githubusercontent.com/36110276/180657602-a2fedf72-07e1-4fa3-b854-428136e48e14.png" width="60" />](https://user-images.githubusercontent.com/36110276/180657602-a2fedf72-07e1-4fa3-b854-428136e48e14.png)

# Batchcamp

A Chrome Extension to add bulk download functionality to Bandcamp

## Why would you want this?

It is very slow and time consuming to download your purchases one by one on Bandcamp. You have to click through to another page, wait for something behind the scenes to generate the link, then download it. However, you can only download so many things at once before you start to get rate limit errors.

This extension is useful if you:
- Buy many releases on Bandcamp Fridays or full artist/label discographies
- Want to download your collection again in a different format
- Had a storage failure and need to re-download everything

## Features

- Adds a checkbox to each release on your collection page: select multiple and hit the Download button!
- Options menu lets you set the download format & number of concurrent downloads

## Installation

Batchcamp is available to install in one click from [the Chrome Web Store](https://chrome.google.com/webstore/detail/batchcamp/jfcffbaekgnenlohblfgpohgdhalgjeb)

Or to manually build and install from source:

```
npm install
npm run build
```

Then add to Chrome by following the instructions for [loading an unpacked extension](https://developer.chrome.com/docs/extensions/mv3/getstarted/#unpacked) and pick the `dist` folder

## Big Room Tech House DJ Tool - TIP(s)!

If Chrome keeps popping up and asking you where to save each download: open up your Chrome settings, search for **Ask where to save each file before downloading** and toggle it off

Multi selecting works using the Shift key. To select everything in your Collection scroll all the way down and keep scrolling until you have loaded everything. Hold down your Shift key and check the final item in the list. This should select everything

## Screenshots

![shot1](https://user-images.githubusercontent.com/36110276/180657889-18a45dcb-60e6-42d2-bc2f-561a29bd861e.png)
![shot2](https://user-images.githubusercontent.com/36110276/180657891-08de3620-ee7e-4ad4-adf2-27eb75821f97.png)
