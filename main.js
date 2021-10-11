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

  slideshow = remark.create({ratio: "4:3"});
  // slideshow = remark.create({ratio: "16:9"});
  slideshow.gotoFirstSlide();
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
