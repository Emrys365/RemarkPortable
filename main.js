var slideshow;

function init_callout_steps(slideshowInstance)
{
  if (window.__calloutStepsInitialized) {
    return;
  }
  window.__calloutStepsInitialized = true;

  function getCurrentSlideRoot()
  {
    return document.querySelector('.remark-visible .remark-slide-content');
  }

  function revealNextCalloutStep()
  {
    var root = getCurrentSlideRoot();
    if (!root) {
      return false;
    }

    var callouts = root.querySelectorAll('.callout.has-steps');
    for (var i = 0; i < callouts.length; i++) {
      var hiddenFragments = callouts[i].querySelectorAll('.callout-fragment[data-step][hidden]');
      if (!hiddenFragments.length) {
        continue;
      }

      var nextStep = Infinity;
      for (var j = 0; j < hiddenFragments.length; j++) {
        var stepValue = parseInt(hiddenFragments[j].getAttribute('data-step'), 10);
        if (!isNaN(stepValue) && stepValue < nextStep) {
          nextStep = stepValue;
        }
      }

      if (nextStep !== Infinity) {
        var nextStepFragments = callouts[i].querySelectorAll('.callout-fragment[data-step="' + nextStep + '"]');
        for (var k = 0; k < nextStepFragments.length; k++) {
          nextStepFragments[k].removeAttribute('hidden');
          nextStepFragments[k].classList.add('is-visible');
        }
        return true;
      }
    }
    return false;
  }

  function hidePreviousCalloutStep()
  {
    var root = getCurrentSlideRoot();
    if (!root) {
      return false;
    }

    var callouts = root.querySelectorAll('.callout.has-steps');
    for (var i = callouts.length - 1; i >= 0; i--) {
      var visibleFragments = callouts[i].querySelectorAll('.callout-fragment[data-step]:not([hidden])');
      var maxStep = 0;

      for (var j = 0; j < visibleFragments.length; j++) {
        var stepValue = parseInt(visibleFragments[j].getAttribute('data-step'), 10);
        if (!isNaN(stepValue) && stepValue > maxStep) {
          maxStep = stepValue;
        }
      }

      if (maxStep > 0) {
        var maxStepFragments = callouts[i].querySelectorAll('.callout-fragment[data-step="' + maxStep + '"]');
        for (var k = 0; k < maxStepFragments.length; k++) {
          maxStepFragments[k].setAttribute('hidden', 'hidden');
          maxStepFragments[k].classList.remove('is-visible');
        }
        return true;
      }
    }
    return false;
  }

  var forwardKeys = {
    'ArrowRight': true,
    'ArrowDown': true,
    'PageDown': true,
    'Enter': true,
    ' ': true,
  };

  var backwardKeys = {
    'ArrowLeft': true,
    'ArrowUp': true,
    'PageUp': true,
    'Backspace': true,
  };

  document.addEventListener('keydown', function (event) {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (forwardKeys[event.key] && revealNextCalloutStep()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (backwardKeys[event.key] && hidePreviousCalloutStep()) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  if (slideshowInstance && typeof slideshowInstance.on === 'function') {
    slideshowInstance.on('showSlide', function () {
      var root = getCurrentSlideRoot();
      if (!root) {
        return;
      }

      var callouts = root.querySelectorAll('.callout.has-steps');
      for (var i = 0; i < callouts.length; i++) {
        var fragments = callouts[i].querySelectorAll('.callout-fragment[data-step]');
        for (var j = 0; j < fragments.length; j++) {
          var stepValue = parseInt(fragments[j].getAttribute('data-step'), 10);
          if (stepValue === 0) {
            fragments[j].removeAttribute('hidden');
            fragments[j].classList.add('is-visible');
          } else {
            fragments[j].setAttribute('hidden', 'hidden');
            fragments[j].classList.remove('is-visible');
          }
        }
      }
    });
  }
}

function init_print_step_expansion()
{
  if (window.__printStepExpansionInitialized) {
    return;
  }
  window.__printStepExpansionInitialized = true;

  var printExpandTimerId = null;

  function expandHiddenFragmentsForPrint()
  {
    var hiddenFragments = document.querySelectorAll('.callout.has-steps .callout-fragment[data-step][hidden]');
    for (var i = 0; i < hiddenFragments.length; i++) {
      hiddenFragments[i].setAttribute('data-print-hidden', '1');
      hiddenFragments[i].removeAttribute('hidden');
      hiddenFragments[i].classList.add('is-visible');
    }
  }

  function startPrintExpansionLoop()
  {
    expandHiddenFragmentsForPrint();
    if (printExpandTimerId !== null) {
      return;
    }
    printExpandTimerId = window.setInterval(function () {
      expandHiddenFragmentsForPrint();
    }, 120);
  }

  function stopPrintExpansionLoop()
  {
    if (printExpandTimerId !== null) {
      window.clearInterval(printExpandTimerId);
      printExpandTimerId = null;
    }
  }

  function restoreHiddenFragmentsAfterPrint()
  {
    stopPrintExpansionLoop();

    var printExpandedFragments = document.querySelectorAll('.callout.has-steps .callout-fragment[data-print-hidden="1"]');
    for (var i = 0; i < printExpandedFragments.length; i++) {
      printExpandedFragments[i].setAttribute('hidden', 'hidden');
      printExpandedFragments[i].removeAttribute('data-print-hidden');
      printExpandedFragments[i].classList.remove('is-visible');
    }
  }

  window.addEventListener('beforeprint', startPrintExpansionLoop);
  window.addEventListener('afterprint', restoreHiddenFragmentsAfterPrint);

  if (window.matchMedia) {
    var printMedia = window.matchMedia('print');
    var mediaListener = function (event) {
      if (event.matches) {
        startPrintExpansionLoop();
      } else {
        restoreHiddenFragmentsAfterPrint();
      }
    };

    if (printMedia.addEventListener) {
      printMedia.addEventListener('change', mediaListener);
    } else if (printMedia.addListener) {
      printMedia.addListener(mediaListener);
    }
  }
}

function unescape_inside_macro(text) {
  return text
    .replace(/&#lpar;/g, '(')
    .replace(/&#rpar;/g, ')')
    .replace(/&#lspar;/g, '[')
    .replace(/&#rspar;/g, ']')
    .replace(/&#lcpar;/g, '{')
    .replace(/&#rcpar;/g, '}');
}

function inline_step_markers(content, marker) {
  var lines = content.split('\n');
  var output = [];
  var fenceToken = null;

  for (var i = 0; i < lines.length; i++) {
    // Detect fenced code blocks and skip processing lines inside them
    var fenceMatch = lines[i].match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      var currentToken = fenceMatch[1].charAt(0);
      // Switch fence token on/off when encountering the same fence delimiter
      if (!fenceToken) {
        fenceToken = currentToken;
      } else if (fenceToken === currentToken) {
        fenceToken = null;
      }
      output.push(lines[i]);
      continue;
    }

    if (fenceToken) {
      output.push(lines[i]);
      continue;
    }

    // Replace `--` with the marker and merge it to the end of the previous line if possible, otherwise keep it as a separate line.
    // This allows step markers to be placed inline in the markdown content without affecting the layout when rendered.
    if (/^--\s*$/.test(lines[i])) {
      var commentMarker = '<!--' + marker + '-->';
      var merged = false;

      for (var j = output.length - 1; j >= 0; j--) {
        if (!/^\s*$/.test(output[j])) {
          // Avoid appending marker to fence delimiter lines.
          if (/^\s*(`{3,}|~{3,})/.test(output[j])) break;
          output[j] += commentMarker;
          merged = true;
          break;
        }
      }

      if (!merged) {
        output.push(commentMarker);
      }
      continue;
    }

    output.push(lines[i]);
  }

  return output.join('\n');
}

function render_callout_with_steps(content)
{
  var marker = 'CALLSTEP_MARKER';
  var markerized_content = inline_step_markers(content, marker);
  var html = remark.convert(markerized_content);
  var container = document.createElement('div');
  var max_step = 0;

  container.innerHTML = html;

  function walk(node, current_step)
  {
    var child = node.firstChild;
    var step = current_step;

    while (child) {
      var next = child.nextSibling;

      if (child.nodeType === 8 && child.nodeValue && child.nodeValue.trim() === marker) {
        step += 1;
        if (step > max_step) {
          max_step = step;
        }
        node.removeChild(child);
      } else {
        if (child.nodeType === 1) {
          child.classList.add('callout-fragment');
          child.setAttribute('data-step', String(step));
          if (step === 0) {
            child.classList.add('is-visible');
            child.removeAttribute('hidden');
          } else {
            child.setAttribute('hidden', 'hidden');
          }
          step = walk(child, step);
        }
      }

      child = next;
    }

    return step;
  }

  walk(container, 0);

  return {
    html: container.innerHTML,
    has_steps: max_step > 0
  };
}

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

  remark.macros.olstart = function (start, indent) {
    // Usage: ![:olstart 7, 1](1. item a\n2. item b)
    var parsed_start = parseInt(start, 10);
    var list_start = isNaN(parsed_start) || parsed_start < 1 ? 1 : parsed_start;
    var parsed_indent = parseInt(indent, 10);
    var list_indent = isNaN(parsed_indent) || parsed_indent < 0 ? 0 : parsed_indent;
    var content = unescape_inside_macro(this);

    var html = remark.convert(content);
    var container = document.createElement('div');
    container.innerHTML = html;

    // Only change the first ordered list if it does not already define a start value.
    var first_ol = container.querySelector('ol');
    if (first_ol && !first_ol.hasAttribute('start')) {
      first_ol.setAttribute('start', String(list_start));
    }

    // Indent only top-level lists (lists not nested under an li element).
    if (list_indent > 0) {
      var indent_em = list_indent * 2;
      var lists = container.querySelectorAll('ol, ul');
      for (var i = 0; i < lists.length; i++) {
        var parent = lists[i].parentElement;
        if (parent && parent.tagName && parent.tagName.toLowerCase() === 'li') {
          continue;
        }

        lists[i].style.marginLeft = indent_em + 'em';
      }
    }

    return container.innerHTML;
  };

  remark.macros.bullet = function (bullet, color, gap) {
    // Usage: ![:bullet ★, #e74c3c, 0.8em](- item a\n- item b)
    var bullet_char = unescape_inside_macro((bullet || '•').trim()) || '•';

    var bullet_color = (color || '').trim() || null;
    var bullet_gap = (gap || '').trim() || null;

    var content = unescape_inside_macro(this);
    var html = remark.convert(content);
    var container = document.createElement('div');
    container.innerHTML = html;

    // Apply unicode-bullet class directly to top-level ul/ol so they share the
    // same DOM nesting level as native remark lists and inherit identical indent.
    var children = container.children;
    for (var i = 0; i < children.length; i++) {
      var el = children[i];
      var tag = el.tagName.toLowerCase();
      if (tag === 'ul' || tag === 'ol') {
        el.classList.add('unicode-bullet');
        if (bullet_gap) {
          el.style.setProperty('--unicode-bullet-gap', bullet_gap);
        }
        if (bullet_color) {
          el.style.setProperty('--unicode-bullet-color', bullet_color);
        }
      }
    }

    var list_items = container.querySelectorAll('li');
    for (var j = 0; j < list_items.length; j++) {
      list_items[j].setAttribute('data-bullet', bullet_char);
    }

    return container.innerHTML;
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
    var content = unescape_inside_macro(this);

    var callout_content_html = '';
    var has_steps = false;

    if (/^\s*--\s*$/m.test(content)) {
      var rendered_steps = render_callout_with_steps(content);
      callout_content_html = rendered_steps.html;
      has_steps = rendered_steps.has_steps;
    } else {
      callout_content_html = remark.convert(content);
    }

    return '<div class="callout callout-' + type + (has_steps ? ' has-steps' : '') + '">' 
         +   '<div class="callout-title" dir="auto">'
         +     '<div class="callout-icon">' + icon_svg + '</div>'
         +     '<div class="callout-title-inner">' + title + '</div>'
         +   '</div>'
         +   '<div class="callout-content">'
         +     callout_content_html
         +   '</div>'
         + '</div>';
  }

  remark.macros.toc = function () {
    // Usage: ![:toc num1, num2, ...](lines of toc content in markdown)
    // The content lines should start with *, -, +, >, or numbered list like 1., 2., etc.
    // To add link to a TOC item, use the format: [text]&#lpar;#link$#rpar; where `#link` is the target slide's name or id, and `text` is the display text for this TOC item.
    //
    // Example:
    // ![:toc 2,4](
    // * [Introduction]&#lpar;#intro$#rpar;
    // * [Usage]&#lpar;#usage$#rpar;
    // * [Examples]&#lpar;#examples$#rpar;
    // * [Conclusion]&#lpar;#conclusion$#rpar;
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
        text = unescape_inside_macro(text);
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

  init_callout_steps(slideshow);
  init_print_step_expansion();

  // Re-typeset MathJax after remark creates slides from textarea content
  if (typeof MathJax !== 'undefined') {
    MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
  }
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
