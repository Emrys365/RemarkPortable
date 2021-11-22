## RemarkPortable

A simple and portable way of using **[Remark](https://github.com/gnab/remark)**, that doesn't require an internet connection. Decluttered `index.html` to make it easier to get an overview.

Also included all necessary files in the repo for easy setup after downloading / cloning.

<!--
---
***Note: I'd personally recommend that you use [Display](https://github.com/BenStigsen/Display) instead, as that is about ~350x lighter (Display is ~2 KB, RemarkPortable is ~700 KB), easier to customize and under active development.***
-->

---

### Getting Started

1. Download or clone this repo (you can also use the **[releases](https://github.com/BenTearzz/RemarkPortable/releases)** page).
2. Write your markdown in the `<textarea>` in `index.html` or in a local file.
3. That's it... now you just open `index.html` in a browser, click `load` and it should work.

---

When opening `index.html`, there'll be two buttons. One to load the HTML content currently in `textarea` and one to open up a local file and use that for presentations. Both buttons will dissappear when entering fullscreen.

---

For customization you can customize `style.css` to your needs. More customization options can be found on the **[Remark Wiki](https://github.com/gnab/remark/wiki/Formatting)**.

---

### Fonts

The fonts included (Ubuntu Mono, Yanone Kaffeesatz and Droid Serif) are all from Google Fonts, which are free to use, as stated **[here](https://fonts.google.com/about)**

>All the fonts in our catalog are free and open source, making beautiful type accessible to anyone for **any** project.

---

### Additional Notes from [Emrys365](https://github.com/Emrys365/)

This customized version is designed as a template for SJTU X-LANCE Lab.

Some new functions are introdued based on the original repository in [BenStigsen/RemarkPortable](https://github.com/BenStigsen/RemarkPortable), including:

* New default fonts: [Open Sans](https://fonts.google.com/specimen/Open+Sans), [Grandstander](https://fonts.google.com/specimen/Grandstander)
* Added header and footer to match the old template in our lab
* Added watermark in the lower right corner: a rotated logo that is placed in the bottom layer
* New default CSS styles for several Markdown elements (` `` `, `> ...`, table)
* Several Markdown macros (image scaling, upper case converter, random word selector), and more can be extended in [main.js#L30](https://github.com/Emrys365/RemarkPortable/blob/sjtu/main.js#L30)
* New [content classes](https://github.com/gnab/remark/wiki/Markdown#content-classes) for convenient use
  * colors: `.red[...]`, `.blue[...]`, etc.
  * font styles: `.bold[...]`, `.italic[...]`, `.bolditalic[...]`, `.cute[...]`
  * text alignment: `.left[...]`, `.right[...]`, `.center[...]`, `.justify[...]`
  * two-column layout: `.left-column[...]`, `.right-column[...]`, etc.
* Support for printing as slides (by default 4:3) with Chrome (not working with Safari)
* Added custom cursor styles and keyboard shortcuts
  * Press `l` or `L` to toggle the switch of a laser pointer
  * Press `s` or `S` to toggle spotlight around the cursor

![preview](https://user-images.githubusercontent.com/18532145/136813819-9a926db1-25d8-47d5-9678-68250f076f73.gif)
