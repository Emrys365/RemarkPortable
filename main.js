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

  // ********************************
  // Define Markdown Macros
  // https://github.com/gnab/remark/issues/72
  remark.macros.upper = function () {
    // `this` is the value in the parenthesis, or undefined if left out
    return this.toUpperCase();
  };

  remark.macros.random = function () {
    // params are passed as function arguments: ["one", "of", "these", "words"]
    var i = Math.floor(Math.random() * arguments.length);
    return arguments[i];
  };

  remark.macros.scale = function (percentage) {
    var url = this;
    return '<img src="' + url + '" style="width: ' + percentage + '" />';
  };
  // ********************************

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
      scroll: false,
    },
    //*********** code highlighting related ***********//
    highlightLanguage: "python",  // https://github.com/isagalaev/highlight.js/tree/master/src/languages
    highlightStyle: "github",         // https://github.com/gnab/remark/wiki/Configuration#highlighting
    highlightLines: false,            // true to highlight background of code lines prefixed with *
    // Inside code blocks, highlight (the background of) content between special delimiters
    highlightSpans: false,            // true to use `backticks` as delimiters
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
