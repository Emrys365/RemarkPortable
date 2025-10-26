// ********************************
// Register custom cursor
// https://medium.com/@benzbraunstein/using-javascript-and-css-to-make-custom-cursors-dd75d40520

let mouseCursor = document.querySelector(".cursor")
let wholePage = document.querySelector(".remark-slides-area")
let slidePage = document.querySelector(".remark-slide-scaler")
window.addEventListener("mousemove", moveCursor)

Mousetrap.bind(['l', 'L'], function() {
  if (wholePage.classList.contains("laser-cursor")) {
    wholePage.classList.remove("laser-cursor")
  } else {
    wholePage.classList.add("laser-cursor")
  }
});



Mousetrap.bind(['s'], function() {
  if (mouseCursor.style.display === "none" || mouseCursor.style.display === "") {
    mouseCursor.style.display = "block";
    // window.addEventListener("mousemove", moveCursor)
    // wholePage.classList.add("hideCursor")
  } else {
    mouseCursor.style.display = "none";
    // window.removeEventListener("mousemove", moveCursor)
    // wholePage.classList.remove("hideCursor")
  }
});

function moveCursor(e) {
  mouseCursor.style.top = e.pageY + "px";
  mouseCursor.style.left = e.pageX + "px";
}

function changeCursorShape(radius) {
  mouseCursor.style.border_radius = radius + "%";
}

Mousetrap.bind(['S'], function() {
  if (mouseCursor.style.display === "block") {
    const radius = parseInt(mouseCursor.style.borderRadius, 10);
    if (radius === 50) {
      mouseCursor.style.borderRadius = "0%";
    } else if (radius === 0) {
      mouseCursor.style.borderRadius = "50%";
    }
  }
});

Mousetrap.bind(['+', '='], function() {
  if (mouseCursor.style.display === "block") {
    mouseCursor.style.width = parseFloat(mouseCursor.style.width) + 0.5 + "rem";
    mouseCursor.style.height = parseFloat(mouseCursor.style.height) + 0.5 + "rem";
  }
});

Mousetrap.bind(['-', '_'], function() {
  if (mouseCursor.style.display === "block") {
    mouseCursor.style.width = Math.max(parseFloat(mouseCursor.style.width) - 0.5, 1.5) + "rem";
    mouseCursor.style.height = Math.max(parseFloat(mouseCursor.style.height) - 0.5, 1.5) + "rem";
  }
});
