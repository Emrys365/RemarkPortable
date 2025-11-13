var slideshow;

// Load file and read content
function loadFile(event)
{
  var selectedFile = event.target.files[0];

  var reader = new FileReader();
  reader.onload = function(event)
  {
    document.getElementById('source').innerHTML = event.target.result;
  };

  reader.readAsText(selectedFile);
}

function register_macros()
{
  // Define Markdown Macros
  // https://github.com/gnab/remark/issues/72#issuecomment-62225566
  remark.macros.upper = function () {
    // Usage: ![:upper](xxx)
    // `this` is the value in the parenthesis, or undefined if left out
    return this.toUpperCase();
  };

  remark.macros.random = function () {
    // Usage: ![:random xxx, yyy, zzz]
    // params are passed as function arguments: ["one", "of", "these", "words"]
    var i = Math.floor(Math.random() * arguments.length);
    return arguments[i];
  };

  remark.macros.scale = function (percentage) {
    // Usage: ![:scale 50%](/xxx/image)
    var url = this;
    return '<img src="' + url + '" style="width: ' + percentage + '" />';
  };

  remark.macros.callout = function () {
    // Usage: ![:callout note, <title>](markdown content)
    var icon_svg = '';
    var type = arguments.length > 0 ? arguments[0] : 'note';
    var title = arguments.length > 1 ? arguments[1] : type.charAt(0).toUpperCase() + type.slice(1);
    switch (type) {
      case 'info':
        icon_svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-info"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>';
        break;
      case 'note':
        icon_svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-pencil"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path><path d="m15 5 4 4"></path></svg>';
        break;
      case 'todo':
        icon_svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-check-circle-2"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path></svg>';
        break;
      case 'tip':
        icon_svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-flame"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>';
        break;
      case 'warn':
        icon_svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-alert-triangle"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>';
        break;
      case 'question':
        icon_svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-help-circle"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path></svg>';
        break;
      case 'danger':
        icon_svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-zap"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"></path></svg>';
        break;
      case 'example':
        icon_svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-list"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>';
        break;
      case 'quote':
        icon_svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-quote"><path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"></path><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"></path></svg>';
        break;
      // Add more callout types as needed
      default:
        icon_svg = '';
    }

    // Convert escaped brackets back to normal brackets `(` and `)` for markdown parsing
    var content = this.replace(/&#lpar;/g, '(').replace(/&#rpar;/g, ')').replace(/&#lspar;/g, '[').replace(/&#rspar;/g, ']');

    return '<div class="callout callout-' + type + '">'
         +   '<div class="callout-title" dir="auto">'
         +     '<div class="callout-icon">' + icon_svg + '</div>'
         +     '<div class="callout-title-inner">' + title + '</div>'
         +   '</div>'
         +   '<div class="callout-content">'
         +     remark.convert(content)
         +   '</div>'
         + '</div>';
  }

  remark.macros.toc = function () {
    // Usage: ![:toc num1, num2, ...](lines of toc content in markdown)
    // The content lines should start with *, -, +, >, or numbered list like 1., 2., etc.
    // To add link to a TOC item, use the format: 【text】（link）
    //
    // Example:
    // ![:toc 2,4](
    // * 【Introduction】（#intro）
    // * 【Usage】（#usage）
    // * 【Examples】（#examples）
    // * 【Conclusion】（#conclusion）
    // )
    // 
    // Note: We cannot support standard markdown link format [text](link) here due to parsing issues.
    var lines = this.split('\n');
    var toc_items = [];
    var num = 0;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.length === 0) {
        continue;
      }
      // Extract number and text
      var match = line.match(/^(\*|>|-|\+|\d+\.)\s+(.*)$/);
      if (match) {
        num++;
        var text = match[2];
        // Convert escaped brackets back to normal brackets `(` and `)` for markdown parsing
        text = text.replace(/&#lpar;/g, '(').replace(/&#rpar;/g, ')').replace(/&#lspar;/g, '[').replace(/&#rspar;/g, ']');
        toc_items.push({
          number: num,
          text: remark.convert(text),
          dim_class: ''
        });
      }
    }

    // get all numbers in arguments to dim toc items
    var not_dim_numbers = [];
    for (var k = 0; k < arguments.length; k++) {
      var n = parseInt(arguments[k].trim());
      if (!isNaN(n) && n > 0 && n <= toc_items.length) {
        not_dim_numbers.push(n);
      }
    }
    if (not_dim_numbers.length > 0) {
      for (var j = 0; j < toc_items.length; j++) {
        if (not_dim_numbers.indexOf(toc_items[j].number) === -1) {
          toc_items[j].dim_class = ' dimmed3';
        }
      }
    }

    // Build HTML for TOC
    var toc_html = '<div class="remark-toc">'
                 +   '<div class="toc-sidebar">'
                 +     '<div class="toc-title-en unselectable">CONTENTS</div>'
                 +     '<div class="toc-title-cn unselectable">目录</div>'
                 +   '</div>'
                 +   '<div class="toc-content">';

    for (var j = 0; j < toc_items.length; j++) {
      toc_html += '<div class="toc-item' + toc_items[j].dim_class + '">'
                +   '<div class="toc-number unselectable">' + toc_items[j].number + '</div>'
                +   '<div class="toc-text-box">' + toc_items[j].text + '</div>'
                + '</div>';
    }

    toc_html +=   '</div></div>';

    return toc_html;
  }
}

// Rebuild slides and delete previous
function loadContent()
{
  document.documentElement.className = '';
  document.body.className = '';

  var x = document.querySelectorAll('div[class^=remark]');

  for (var i = 0; i < x.length; i++)
  {
    (x[i]).parentNode.removeChild(x[i]);
  }

  register_macros();

  slideshow = remark.create({
    // Set the slideshow display ratio
    ratio: "4:3",
    // Customize slide number label, either using a format string
    // https://github.com/gnab/remark/issues/130#issuecomment-47468524
    slideNumberFormat: "%current% / %total%",
    // .. or by using a format function
    // slideNumberFormat: function (current, total) {
    //   return current + " / " + total;
    // },
    // Enable or disable counting of incremental slides in the slide counting
    countIncrementalSlides: false,
    // enable or disable scrolling-based navigation
    navigation: {
      // Enable or disable navigating using scroll
      // Default: true
      // Alternatives: false
      scroll: false,

      // Enable or disable navigation using touch
      // Default: true
      // Alternatives: false
      touch: true,

      // Enable or disable navigation using click
      // Default: false
      // Alternatives: true
      click: false,
    },
    //*********** code highlighting related ***********//
    highlightLanguage: "python",  // https://github.com/isagalaev/highlight.js/tree/master/src/languages
    highlightStyle: "github",         // https://github.com/gnab/remark/wiki/Configuration#highlighting
    highlightLines: true,            // true to highlight background of code lines prefixed with *
    // Inside code blocks, highlight (the background of) content between special delimiters
    highlightSpans: true,            // true to use `backticks` as delimiters
  });
  // slideshow = remark.create({ratio: "16:9"});
  // slideshow.gotoFirstSlide();         // uncomment this line to always start from the first slide
}


loadContent();

// Automatically set the page size to support print to PDF
// https://github.com/gnab/remark/issues/50#issuecomment-321141963
(function() {
  var d = document, s = d.createElement("style"), r = d.querySelector(".remark-slide-scaler");
  if (!r) return;
  s.type = "text/css";
  s.innerHTML = "@page { size: " + r.style.width + " " + r.style.height +"; margin: 0; }";
  d.head.appendChild(s);
})();
