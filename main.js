var slideshow;

var presentation_config = {
  // print_animation:
  // - 'expand': print all animation fragments on the same slide page
  // - 'split': split one animated slide into multiple print pages by animation step
  print_animation: 'expand'
};

// Tag an element as an animation fragment belonging to `step`, in its start-of-slide
// state: step 0 is on screen from the outset, later steps wait to be revealed.
function set_step_fragment(element, step)
{
  element.classList.add('callout-fragment');
  element.setAttribute('data-step', String(step));

  if (step === 0) {
    element.classList.add('is-visible');
    element.removeAttribute('hidden');
  } else {
    element.setAttribute('hidden', 'hidden');
  }
}

// Elements that legitimately hold no children, so emptiness says nothing about them.
var VOID_FRAGMENT_TAG = /^(img|svg|canvas|video|iframe|object|embed|hr|br|input|table)$/;

// A separator with nothing before it leaves markdown wrapping the marker in an element
// of its own. With the marker gone that element is empty, and remark already discards
// empty paragraphs of its own accord, so discard it here too instead of letting it hold
// a blank line open for the rest of the animation. Only called for elements that did
// contain a marker, so genuinely empty markup the author wrote is left alone.
function drop_if_emptied_by_marker(element)
{
  if (!element || !element.parentNode) {
    return;
  }
  if (VOID_FRAGMENT_TAG.test(element.tagName.toLowerCase())) {
    return;
  }
  if (element.firstElementChild || /\S/.test(element.textContent || '')) {
    return;
  }

  element.parentNode.removeChild(element);
}

// On a slide created by a forced page break (`--` + `name:`), remark re-renders the
// previous slide's content above the break. That inherited content has already been
// stepped through, so mark its blocks: they start fully revealed and are skipped when
// stepping, instead of replaying their animation before the new content's.
function mark_inherited_step_blocks(root)
{
  if (!root) {
    return;
  }

  var resumeBlocks = root.querySelectorAll('.' + BLOCK_STEP_RESUME_CLASS);
  var lastResume = resumeBlocks.length ? resumeBlocks[resumeBlocks.length - 1] : null;
  var stepBlocks = root.querySelectorAll('.has-steps');

  for (var i = 0; i < stepBlocks.length; i++) {
    var inherited = lastResume &&
      (lastResume.compareDocumentPosition(stepBlocks[i]) & Node.DOCUMENT_POSITION_PRECEDING);

    if (inherited) {
      stepBlocks[i].setAttribute('data-steps-inherited', '1');
    } else {
      stepBlocks[i].removeAttribute('data-steps-inherited');
    }
  }
}

// Put every step block on a slide into its start-of-slide state: inherited blocks fully
// revealed, everything else rewound to step 0.
function apply_step_block_initial_state(root)
{
  if (!root) {
    return;
  }

  mark_inherited_step_blocks(root);

  var stepBlocks = root.querySelectorAll('.has-steps');
  for (var i = 0; i < stepBlocks.length; i++) {
    var inherited = stepBlocks[i].hasAttribute('data-steps-inherited');
    var fragments = stepBlocks[i].querySelectorAll('.callout-fragment[data-step]');

    for (var j = 0; j < fragments.length; j++) {
      var stepValue = parseInt(fragments[j].getAttribute('data-step'), 10);
      if (inherited || stepValue === 0) {
        fragments[j].removeAttribute('hidden');
        fragments[j].classList.add('is-visible');
      } else {
        fragments[j].setAttribute('hidden', 'hidden');
        fragments[j].classList.remove('is-visible');
      }
    }
  }
}

function init_callout_steps(slideshowInstance)
{
  if (window.__calloutStepsInitialized) {
    return;
  }
  window.__calloutStepsInitialized = true;

  var CALLSTEP_SYNC_KEY = 'remark-callstep-sync';
  var CALLSTEP_SYNC_KIND = 'callstep-state';
  var callstepSyncSenderId = String(Date.now()) + '-' + String(Math.random()).slice(2);
  var callstepSyncChannel = null;
  var pendingCallstepStateBySlide = {};

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      callstepSyncChannel = new BroadcastChannel(CALLSTEP_SYNC_KEY);
    }
  } catch (error) {
    callstepSyncChannel = null;
  }

  function getCurrentSlideRoot()
  {
    return document.querySelector('.remark-visible .remark-slide-content');
  }

  function getCurrentSlideIndex()
  {
    var visibleSlide = document.querySelector('.remark-slide-container.remark-visible');
    if (!visibleSlide) {
      return -1;
    }

    var slides = document.querySelectorAll('.remark-slide-container');
    for (var i = 0; i < slides.length; i++) {
      if (slides[i] === visibleSlide) {
        return i;
      }
    }

    return -1;
  }

  function getBlockCurrentStep(block)
  {
    var visibleFragments = block.querySelectorAll('.callout-fragment[data-step]:not([hidden])');
    var maxStep = 0;

    for (var i = 0; i < visibleFragments.length; i++) {
      var stepValue = parseInt(visibleFragments[i].getAttribute('data-step'), 10);
      if (!isNaN(stepValue) && stepValue > maxStep) {
        maxStep = stepValue;
      }
    }

    return maxStep;
  }

  function collectCurrentSlideStepState(root)
  {
    var state = {
      slideIndex: getCurrentSlideIndex(),
      blockSteps: []
    };

    if (!root) {
      return state;
    }

    var stepBlocks = root.querySelectorAll('.has-steps:not([data-steps-inherited])');
    for (var i = 0; i < stepBlocks.length; i++) {
      state.blockSteps.push(getBlockCurrentStep(stepBlocks[i]));
    }

    return state;
  }

  function applyStepStateToSlideRoot(root, blockSteps)
  {
    if (!root) {
      return;
    }

    var stepBlocks = root.querySelectorAll('.has-steps:not([data-steps-inherited])');
    for (var i = 0; i < stepBlocks.length; i++) {
      var targetStep = parseInt(blockSteps && blockSteps[i], 10);
      if (isNaN(targetStep) || targetStep < 0) {
        targetStep = 0;
      }

      var fragments = stepBlocks[i].querySelectorAll('.callout-fragment[data-step]');
      for (var j = 0; j < fragments.length; j++) {
        var stepValue = parseInt(fragments[j].getAttribute('data-step'), 10);
        if (!isNaN(stepValue) && stepValue <= targetStep) {
          fragments[j].removeAttribute('hidden');
          fragments[j].classList.add('is-visible');
        } else {
          fragments[j].setAttribute('hidden', 'hidden');
          fragments[j].classList.remove('is-visible');
        }
      }
    }
  }

  function storePendingCallstepState(message)
  {
    if (!message || typeof message.slideIndex !== 'number' || message.slideIndex < 0) {
      return;
    }

    var existing = pendingCallstepStateBySlide[message.slideIndex];
    if (!existing || (message.ts || 0) >= (existing.ts || 0)) {
      pendingCallstepStateBySlide[message.slideIndex] = message;
    }
  }

  function applyPendingStateForCurrentSlide()
  {
    var currentIndex = getCurrentSlideIndex();
    if (currentIndex < 0) {
      return;
    }

    var pending = pendingCallstepStateBySlide[currentIndex];
    if (!pending || !pending.blockSteps) {
      return;
    }

    applyStepStateToSlideRoot(getCurrentSlideRoot(), pending.blockSteps);
  }

  function broadcastCurrentStepState(reason)
  {
    var state = collectCurrentSlideStepState(getCurrentSlideRoot());
    if (state.slideIndex < 0) {
      return;
    }

    var message = {
      kind: CALLSTEP_SYNC_KIND,
      senderId: callstepSyncSenderId,
      slideIndex: state.slideIndex,
      blockSteps: state.blockSteps,
      reason: reason || 'update',
      ts: Date.now()
    };

    storePendingCallstepState(message);

    if (callstepSyncChannel) {
      try {
        callstepSyncChannel.postMessage(message);
      } catch (error) {
        // no-op
      }
    }

    try {
      window.localStorage.setItem(CALLSTEP_SYNC_KEY, JSON.stringify(message));
      window.localStorage.removeItem(CALLSTEP_SYNC_KEY);
    } catch (error) {
      // no-op
    }
  }

  function handleIncomingCallstepState(message)
  {
    if (!message || message.kind !== CALLSTEP_SYNC_KIND || !message.blockSteps) {
      return;
    }

    if (message.senderId === callstepSyncSenderId) {
      return;
    }

    storePendingCallstepState(message);

    if (message.slideIndex !== getCurrentSlideIndex()) {
      return;
    }

    applyStepStateToSlideRoot(getCurrentSlideRoot(), message.blockSteps);
  }

  if (callstepSyncChannel) {
    callstepSyncChannel.addEventListener('message', function (event) {
      handleIncomingCallstepState(event && event.data);
    });
  }

  window.addEventListener('storage', function (event) {
    if (!event || event.key !== CALLSTEP_SYNC_KEY || !event.newValue) {
      return;
    }

    try {
      handleIncomingCallstepState(JSON.parse(event.newValue));
    } catch (error) {
      // no-op
    }
  });

  function revealNextCalloutStep()
  {
    var root = getCurrentSlideRoot();
    if (!root) {
      return false;
    }

    var stepBlocks = root.querySelectorAll('.has-steps:not([data-steps-inherited])');
    for (var i = 0; i < stepBlocks.length; i++) {
      var hiddenFragments = stepBlocks[i].querySelectorAll('.callout-fragment[data-step][hidden]');
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
        var nextStepFragments = stepBlocks[i].querySelectorAll('.callout-fragment[data-step="' + nextStep + '"]');
        for (var k = 0; k < nextStepFragments.length; k++) {
          nextStepFragments[k].removeAttribute('hidden');
          nextStepFragments[k].classList.add('is-visible');
        }
        broadcastCurrentStepState('forward');
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

    var stepBlocks = root.querySelectorAll('.has-steps:not([data-steps-inherited])');
    for (var i = stepBlocks.length - 1; i >= 0; i--) {
      var visibleFragments = stepBlocks[i].querySelectorAll('.callout-fragment[data-step]:not([hidden])');
      var maxStep = 0;

      for (var j = 0; j < visibleFragments.length; j++) {
        var stepValue = parseInt(visibleFragments[j].getAttribute('data-step'), 10);
        if (!isNaN(stepValue) && stepValue > maxStep) {
          maxStep = stepValue;
        }
      }

      if (maxStep > 0) {
        var maxStepFragments = stepBlocks[i].querySelectorAll('.callout-fragment[data-step="' + maxStep + '"]');
        for (var k = 0; k < maxStepFragments.length; k++) {
          maxStepFragments[k].setAttribute('hidden', 'hidden');
          maxStepFragments[k].classList.remove('is-visible');
        }
        broadcastCurrentStepState('backward');
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

      apply_step_block_initial_state(root);
      applyPendingStateForCurrentSlide();
    });
  }
}

function init_block_step_divs(slideshowInstance)
{
  if (window.__blockStepDivsInitialized) {
    return;
  }
  window.__blockStepDivsInitialized = true;

  function processStepBlock(block)
  {
    if (!block || block.classList.contains('has-steps')) {
      return;
    }

    var hasMarker = false;

    function isMarkerNode(node)
    {
      if (node.nodeType === 8) {
        return (node.nodeValue || '').trim() === BLOCK_STEP_MARKER;
      }

      return node.nodeType === 1 && node.tagName &&
        node.tagName.toLowerCase() === 'p' && (node.textContent || '').trim() === '--';
    }

    function containsMarker(node)
    {
      for (var child = node.firstChild; child; child = child.nextSibling) {
        if (isMarkerNode(child)) {
          return true;
        }
        if (child.nodeType === 1 && !child.classList.contains('has-steps') && containsMarker(child)) {
          return true;
        }
      }
      return false;
    }

    // Blocks without a separator are left exactly as remark rendered them.
    var blockHasMarkers = containsMarker(block);

    function walk(node, currentStep)
    {
      // A separator placed before any text leaves the marker as the first thing inside
      // its paragraph, so the steps split that paragraph's own text rather than whole
      // elements. Text nodes cannot carry data-step, so wrap those a marker has pushed
      // past `currentStep`; anything still at `currentStep` is covered by the element
      // around it. The block itself is not a fragment, so its own text always needs one.
      var isBlockRoot = blockHasMarkers && node === block;
      var child = node.firstChild;
      var step = currentStep;

      while (child) {
        var next = child.nextSibling;

        if (isMarkerNode(child)) {
          step += 1;
          hasMarker = true;
          node.removeChild(child);
        } else if (child.nodeType === 3) {
          if ((isBlockRoot || step !== currentStep) && /\S/.test(child.nodeValue || '')) {
            var span = document.createElement('span');
            set_step_fragment(span, step);
            node.replaceChild(span, child);
            span.appendChild(child);
          }
        } else if (child.nodeType === 1 && child.classList.contains('has-steps')) {
          // Macro-rendered blocks (callout, olstart) computed their own steps already.
          // Treat them as opaque so we don't overwrite their data-step values.
        } else if (child.nodeType === 1) {
          set_step_fragment(child, step);
          var stepBefore = step;
          step = walk(child, step);
          if (step !== stepBefore) {
            drop_if_emptied_by_marker(child);
          }
        }

        child = next;
      }

      return step;
    }

    walk(block, 0);

    if (hasMarker) {
      block.classList.add('has-steps');
    }
  }

  function processSlides(scope)
  {
    // Process each top-level child of the slide independently (its own step
    // counter starting at 0), instead of only div[class*="left-column"/"right-column"].
    // remark's `.class[content]` syntax (e.g. .small[], .midsize[]) never parses `--`
    // as a slide separator inside its content, so a literal `<p>--</p>` can end up
    // nested in any class-div, not only left-column/right-column. Keeping each
    // top-level child as its own block preserves independent step counting between
    // sibling blocks (e.g. left-column vs. right-column) instead of one shared count.
    var slideRoots = scope.querySelectorAll('.remark-slide-content');
    for (var i = 0; i < slideRoots.length; i++) {
      var children = slideRoots[i].children;
      for (var j = 0; j < children.length; j++) {
        processStepBlock(children[j]);
      }
    }
  }

  // Slides are built once, so set every slide's start state up front. Doing it here
  // rather than only on showSlide covers slides shown before the handler is attached.
  function applyInitialStates(scope)
  {
    var slideRoots = scope.querySelectorAll('.remark-slide-content');
    for (var i = 0; i < slideRoots.length; i++) {
      apply_step_block_initial_state(slideRoots[i]);
    }
  }

  processSlides(document);
  applyInitialStates(document);

  if (slideshowInstance && typeof slideshowInstance.on === 'function') {
    slideshowInstance.on('showSlide', function () {
      processSlides(document);
    });
  }
}

function init_print_step_expansion(config)
{
  if (window.__printStepExpansionInitialized) {
    return;
  }
  window.__printStepExpansionInitialized = true;

  var printAnimationMode = (config && config.print_animation === 'split') ? 'split' : 'expand';
  var printExpandTimerId = null;
  var detachedSlidesForPrint = [];
  var printSessionActive = false;

  function clearNativePrintHiddenSlides()
  {
    var hiddenSlides = document.querySelectorAll('.remark-slide-container.print-animation-native-hidden');
    for (var i = 0; i < hiddenSlides.length; i++) {
      hiddenSlides[i].classList.remove('print-animation-native-hidden');
    }
  }

  function clearEmptyPrintHiddenSlides()
  {
    var hiddenSlides = document.querySelectorAll('.remark-slide-container.print-animation-empty-hidden');
    for (var i = 0; i < hiddenSlides.length; i++) {
      hiddenSlides[i].classList.remove('print-animation-empty-hidden');
    }
  }

  function clearLastPrintableMarker()
  {
    var marked = document.querySelectorAll('.remark-slide-container.print-animation-last-visible');
    for (var i = 0; i < marked.length; i++) {
      marked[i].classList.remove('print-animation-last-visible');
    }
  }

  function restoreDetachedSlidesAfterPrint()
  {
    if (!detachedSlidesForPrint.length) {
      return;
    }

    for (var i = 0; i < detachedSlidesForPrint.length; i++) {
      var record = detachedSlidesForPrint[i];
      if (!record || !record.parent || !record.slide) {
        continue;
      }

      if (record.nextSibling && record.nextSibling.parentNode === record.parent) {
        record.parent.insertBefore(record.slide, record.nextSibling);
      } else {
        record.parent.appendChild(record.slide);
      }
    }

    detachedSlidesForPrint = [];
  }

  function detachNonPrintableSlidesForPrint()
  {
    restoreDetachedSlidesAfterPrint();

    var slides = document.querySelectorAll('.remark-slide-container');
    for (var i = 0; i < slides.length; i++) {
      var slide = slides[i];
      if (!slide || !slide.parentNode) {
        continue;
      }

      var shouldDetach = false;

      if (slide.classList.contains('print-animation-original-hidden')) {
        shouldDetach = true;
      }
      if (slide.classList.contains('print-animation-native-hidden')) {
        shouldDetach = true;
      }
      if (slide.classList.contains('print-animation-empty-hidden')) {
        shouldDetach = true;
      }

      var content = slide.querySelector('.remark-slide-content');
      if (!shouldDetach && !hasPrintableContent(content)) {
        shouldDetach = true;
      }

      if (!shouldDetach) {
        continue;
      }

      detachedSlidesForPrint.push({
        parent: slide.parentNode,
        nextSibling: slide.nextSibling,
        slide: slide
      });
      slide.parentNode.removeChild(slide);
    }
  }

  function hasPrintableContent(slideContent)
  {
    if (!slideContent) {
      return false;
    }

    var sandbox = slideContent.cloneNode(true);
    var metaNodes = sandbox.querySelectorAll('.remark-slide-number, .remark-slide-notes');
    for (var m = 0; m < metaNodes.length; m++) {
      if (metaNodes[m].parentNode) {
        metaNodes[m].parentNode.removeChild(metaNodes[m]);
      }
    }

    var hiddenNodes = sandbox.querySelectorAll('[hidden], [aria-hidden="true"]');
    for (var i = 0; i < hiddenNodes.length; i++) {
      if (hiddenNodes[i].parentNode) {
        hiddenNodes[i].parentNode.removeChild(hiddenNodes[i]);
      }
    }

    var text = (sandbox.textContent || '').replace(/\s+/g, '');
    if (text.length > 0) {
      return true;
    }

    return !!sandbox.querySelector('img,svg,canvas,video,iframe,object,embed,table,hr');
  }

  function hideEmptySlidesForPrint()
  {
    clearEmptyPrintHiddenSlides();

    var slides = document.querySelectorAll('.remark-slide-container');
    for (var i = 0; i < slides.length; i++) {
      if (slides[i].classList.contains('print-animation-original-hidden')) {
        continue;
      }

      var content = slides[i].querySelector('.remark-slide-content');
      if (!hasPrintableContent(content)) {
        slides[i].classList.add('print-animation-empty-hidden');
      }
    }
  }

  function markLastPrintableSlide()
  {
    clearLastPrintableMarker();

    var slides = document.querySelectorAll('.remark-slide-container');
    for (var i = slides.length - 1; i >= 0; i--) {
      if (slides[i].classList.contains('print-animation-original-hidden')) {
        continue;
      }
      if (slides[i].classList.contains('print-animation-native-hidden')) {
        continue;
      }
      if (slides[i].classList.contains('print-animation-empty-hidden')) {
        continue;
      }

      var content = slides[i].querySelector('.remark-slide-content');
      if (!hasPrintableContent(content)) {
        continue;
      }

      slides[i].classList.add('print-animation-last-visible');
      break;
    }
  }

  function normalizePrintCloneVisibility(clone)
  {
    if (!clone) {
      return;
    }

    clone.classList.remove('remark-visible');
    clone.classList.remove('remark-fading');
    clone.removeAttribute('aria-hidden');

    if (clone.style) {
      clone.style.display = '';
      clone.style.visibility = '';
      clone.style.opacity = '';
    }
  }

  function hideNativeContinuedSlidesForExpand()
  {
    clearNativePrintHiddenSlides();

    if (!slideshow || typeof slideshow.getSlides !== 'function') {
      return;
    }

    var slides = slideshow.getSlides();
    var containers = document.querySelectorAll('.remark-slide-container');
    var limit = Math.min(slides.length, containers.length);
    var index = 0;

    while (index < limit) {
      var groupEnd = index;

      while (
        groupEnd + 1 < limit &&
        slides[groupEnd + 1] &&
        slides[groupEnd + 1].properties &&
        slides[groupEnd + 1].properties.continued === 'true'
      ) {
        groupEnd += 1;
      }

      for (var k = index; k < groupEnd; k++) {
        containers[k].classList.add('print-animation-native-hidden');
      }

      index = groupEnd + 1;
    }
  }

  function getCalloutMaxStep(scope)
  {
    var fragments = scope.querySelectorAll('.has-steps .callout-fragment[data-step]');
    var maxStep = 0;
    for (var i = 0; i < fragments.length; i++) {
      var value = parseInt(fragments[i].getAttribute('data-step'), 10);
      if (!isNaN(value) && value > maxStep) {
        maxStep = value;
      }
    }
    return maxStep;
  }

  function applyStepState(scope, step)
  {
    var fragments = scope.querySelectorAll('.has-steps .callout-fragment[data-step]');
    for (var i = 0; i < fragments.length; i++) {
      var value = parseInt(fragments[i].getAttribute('data-step'), 10);
      if (!isNaN(value) && value <= step) {
        fragments[i].removeAttribute('hidden');
        fragments[i].classList.add('is-visible');
      } else {
        fragments[i].setAttribute('hidden', 'hidden');
        fragments[i].classList.remove('is-visible');
      }
    }
  }

  function prepareSplitPrintSlides()
  {
    cleanupSplitPrintSlides();
    clearNativePrintHiddenSlides();

    var slides = document.querySelectorAll('.remark-slide-container');
    for (var i = 0; i < slides.length; i++) {
      if (slides[i].classList.contains('print-animation-clone')) {
        continue;
      }

      var content = slides[i].querySelector('.remark-slide-content');
      if (!content) {
        continue;
      }

      var maxStep = getCalloutMaxStep(content);
      if (maxStep <= 0) {
        continue;
      }

      slides[i].classList.add('print-animation-original-hidden');

      var insertAnchor = slides[i];
      for (var step = 0; step <= maxStep; step++) {
        var clone = slides[i].cloneNode(true);
        clone.classList.remove('print-animation-original-hidden');
        clone.classList.add('print-animation-clone');
        clone.setAttribute('data-print-step', String(step));
        normalizePrintCloneVisibility(clone);

        var cloneContent = clone.querySelector('.remark-slide-content');
        if (cloneContent) {
          applyStepState(cloneContent, step);

          if (!hasPrintableContent(cloneContent)) {
            continue;
          }
        }

        insertAnchor.parentNode.insertBefore(clone, insertAnchor.nextSibling);
        insertAnchor = clone;
      }
    }

    document.body.classList.add('print-animation-split-mode');
    hideEmptySlidesForPrint();
    markLastPrintableSlide();
    detachNonPrintableSlidesForPrint();
  }

  function cleanupSplitPrintSlides()
  {
    var clones = document.querySelectorAll('.remark-slide-container.print-animation-clone');
    for (var i = 0; i < clones.length; i++) {
      if (clones[i].parentNode) {
        clones[i].parentNode.removeChild(clones[i]);
      }
    }

    var originals = document.querySelectorAll('.remark-slide-container.print-animation-original-hidden');
    for (var j = 0; j < originals.length; j++) {
      originals[j].classList.remove('print-animation-original-hidden');
    }

    document.body.classList.remove('print-animation-split-mode');
    clearEmptyPrintHiddenSlides();
    clearLastPrintableMarker();
    restoreDetachedSlidesAfterPrint();
  }

  function prepareExpandPrintSlides()
  {
    cleanupSplitPrintSlides();
    hideNativeContinuedSlidesForExpand();
    expandHiddenFragmentsForPrint();
    hideEmptySlidesForPrint();
    markLastPrintableSlide();
    detachNonPrintableSlidesForPrint();
  }

  function expandHiddenFragmentsForPrint()
  {
    var hiddenFragments = document.querySelectorAll('.has-steps .callout-fragment[data-step][hidden]');
    for (var i = 0; i < hiddenFragments.length; i++) {
      hiddenFragments[i].setAttribute('data-print-hidden', '1');
      hiddenFragments[i].removeAttribute('hidden');
      hiddenFragments[i].classList.add('is-visible');
    }
  }

  function startPrintExpansionLoop()
  {
    if (printSessionActive) {
      return;
    }
    printSessionActive = true;

    if (printAnimationMode === 'split') {
      prepareSplitPrintSlides();
      return;
    }

    prepareExpandPrintSlides();
    if (printExpandTimerId !== null) {
      return;
    }
    printExpandTimerId = window.setInterval(function () {
      expandHiddenFragmentsForPrint();
    }, 120);
  }

  function stopPrintExpansionLoop()
  {
    if (printAnimationMode === 'split') {
      cleanupSplitPrintSlides();
      clearNativePrintHiddenSlides();
      return;
    }

    if (printExpandTimerId !== null) {
      window.clearInterval(printExpandTimerId);
      printExpandTimerId = null;
    }
  }

  function restoreHiddenFragmentsAfterPrint()
  {
    if (!printSessionActive) {
      return;
    }
    printSessionActive = false;

    stopPrintExpansionLoop();
    restoreDetachedSlidesAfterPrint();
    clearNativePrintHiddenSlides();
    clearEmptyPrintHiddenSlides();
    clearLastPrintableMarker();

    var printExpandedFragments = document.querySelectorAll('.has-steps .callout-fragment[data-print-hidden="1"]');
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

var BLOCK_STEP_MARKER = 'BLOCKSTEP_MARKER';
// Marks the first block of a slide produced by a forced page break, i.e. the boundary
// between content inherited from the previous slide and this slide's own content.
var BLOCK_STEP_RESUME_CLASS = 'step-resume';

// Rewrite bare `--` lines inside multi-line `.class[...]` blocks (.small[], .midsize[],
// .left-column[], ...) into marker comments before remark parses the source.
// remark only treats `--` as a slide separator at slide top level; inside class-block
// content it is handed straight to the markdown parser, which swallows it as a setext
// heading underline (turning the preceding line into an <h2>) instead of producing a
// step break. Markers survive markdown as comment nodes, which init_block_step_divs
// then turns into animation steps.
// Content inside `![:macro](...)` is left alone: those macros run inline_step_markers
// on their own content and detect steps by testing for bare `--` lines.
// A `--` immediately followed by a slide-property line (`name: xxx`, ...) means a forced
// page break naming the new slide rather than an animation step. Inside a class block
// that cannot work as written, so the open wrappers are closed before the separator and
// re-opened after the property lines, giving a real named slide with the same styling.
var SLIDE_PROPERTY_LINE = /^\s*(name|class|layout|count|template|exclude|background-image)\s*:/;

function expand_block_step_markers(text, marker) {
  if (!text) {
    return text;
  }

  var lines = text.split('\n');
  var output = [];
  var fenceToken = null;
  var bracketDepth = 0;
  var classBlockDepths = [];
  var macroParenDepth = 0;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];

    var fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      var fenceChar = fenceMatch[1].charAt(0);
      if (!fenceToken) {
        fenceToken = fenceChar;
      } else if (fenceToken === fenceChar) {
        fenceToken = null;
      }
      output.push(line);
      continue;
    }

    if (fenceToken) {
      output.push(line);
      continue;
    }

    var startsNamedSlide = SLIDE_PROPERTY_LINE.test(lines[i + 1] || '');
    var isStepSeparator = macroParenDepth === 0 && /^--\s*$/.test(line);

    if (classBlockDepths.length > 0 && isStepSeparator && startsNamedSlide) {
      // Forced page break inside a class block. remark's class-block lexer has no
      // separator rule, so `--` here can never start a new slide on its own and the
      // `name:` line would render as literal text. Close the open wrappers, emit the
      // real separator with its slide properties, then re-open the same wrappers so
      // the new slide keeps the same styling.
      var closers = '';
      var reopeners = '';
      for (var c = 0; c < classBlockDepths.length; c++) {
        closers += ']';
        // Tag the outermost re-opened wrapper so the runtime can tell the content of
        // this new slide from the content it inherits from before the break: a `--`
        // slide is "continued", so everything above this point is shown again and
        // must not replay its animation.
        reopeners += c === 0
          ? classBlockDepths[c].text.replace(/\[$/, '.' + BLOCK_STEP_RESUME_CLASS + '[')
          : classBlockDepths[c].text;
      }

      output.push(closers);
      output.push('--');

      var p = i + 1;
      while (p < lines.length && SLIDE_PROPERTY_LINE.test(lines[p])) {
        output.push(lines[p]);
        p++;
      }

      output.push(reopeners);
      i = p - 1;
      continue;
    }

    if (classBlockDepths.length > 0 && isStepSeparator && !startsNamedSlide) {
      // Attach the marker to the end of the previous non-blank line so it lands inside
      // that line's element, keeping list/paragraph structure intact.
      var commentMarker = '<!--' + marker + '-->';
      var mergeIndex = -1;

      for (var j = output.length - 1; j >= 0; j--) {
        if (!/^\s*$/.test(output[j])) {
          if (!/^\s*(`{3,}|~{3,})/.test(output[j])) {
            mergeIndex = j;
          }
          break;
        }
      }

      if (mergeIndex >= 0) {
        output[mergeIndex] += commentMarker;
      } else {
        output.push(commentMarker);
      }
      continue;
    }

    var inlineCodeFence = 0;

    for (var k = 0; k < line.length; k++) {
      var ch = line[k];

      if (ch === '`') {
        var runStart = k;
        while (k < line.length && line[k] === '`') {
          k++;
        }
        var runLength = k - runStart;
        k--;

        if (!inlineCodeFence) {
          inlineCodeFence = runLength;
        } else if (inlineCodeFence === runLength) {
          inlineCodeFence = 0;
        }
        continue;
      }

      if (inlineCodeFence) {
        continue;
      }

      // Macro content is opaque here: consume it without tracking brackets, so
      // unbalanced brackets inside a macro cannot corrupt class-block tracking.
      if (macroParenDepth > 0) {
        if (ch === '(') {
          macroParenDepth++;
        } else if (ch === ')') {
          macroParenDepth--;
        }
        continue;
      }

      if (ch === '!' && line.slice(k, k + 3) === '![:') {
        var headerEnd = line.indexOf(']', k);
        if (headerEnd === -1) {
          break;
        }
        k = headerEnd;
        if (line.charAt(headerEnd + 1) === '(') {
          macroParenDepth = 1;
          k = headerEnd + 1;
        }
        continue;
      }

      if (ch === '[') {
        // Remember the opening text (".midsize[") so a forced page break can re-open
        // the same wrappers on the next slide.
        var classOpen = /((?:\.[A-Za-z0-9_-]+)+)$/.exec(line.slice(0, k));
        if (classOpen) {
          classBlockDepths.push({ depth: bracketDepth, text: classOpen[1] + '[' });
        }
        bracketDepth++;
        continue;
      }

      if (ch === ']') {
        if (bracketDepth > 0) {
          bracketDepth--;
        }
        if (classBlockDepths.length > 0 && classBlockDepths[classBlockDepths.length - 1].depth === bracketDepth) {
          classBlockDepths.pop();
        }
      }
    }

    output.push(line);
  }

  return output.join('\n');
}

function expand_inline_class_macros(text) {
  if (!text) {
    return text;
  }

  var lines = text.split('\n');
  var output = [];
  var fenceToken = null;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      var currentToken = fenceMatch[1].charAt(0);
      if (!fenceToken) {
        fenceToken = currentToken;
      } else if (fenceToken === currentToken) {
        fenceToken = null;
      }

      output.push(line);
      continue;
    }

    if (fenceToken) {
      output.push(line);
      continue;
    }

    var lineOutput = [];
    var segmentBuffer = '';
    var inInlineCode = false;
    var inlineCodeFence = 0;

    function flushSegmentBuffer() {
      if (!segmentBuffer) {
        return;
      }

      var transformed = segmentBuffer;
      var previous = null;

      do {
        previous = transformed;
        transformed = transformed.replace(/(^|[^\w])((?:\.[A-Za-z0-9_-]+)+)\[([^\[\]]*)\]/g, function (match, prefix, classChain, content) {
          var classNames = classChain.split('.').filter(Boolean).join(' ');
          return prefix + '<span class="' + classNames + '">' + content + '</span>';
        });
      } while (transformed !== previous);

      lineOutput.push(transformed);
      segmentBuffer = '';
    }

    for (var j = 0; j < line.length; ) {
      if (line[j] === '`') {
        var runStart = j;
        while (j < line.length && line[j] === '`') {
          j++;
        }

        var run = line.slice(runStart, j);

        if (!inInlineCode) {
          flushSegmentBuffer();
          lineOutput.push(run);
          inInlineCode = true;
          inlineCodeFence = run.length;
          continue;
        }

        if (run.length === inlineCodeFence) {
          lineOutput.push(run);
          inInlineCode = false;
          inlineCodeFence = 0;
        } else {
          lineOutput.push(run);
        }
        continue;
      }

      if (inInlineCode) {
        lineOutput.push(line[j]);
      } else {
        segmentBuffer += line[j];
      }
      j++;
    }

    flushSegmentBuffer();
    output.push(lineOutput.join(''));
  }

  return output.join('\n');
}

// Index of the last line of a run starting at `start` that holds nothing but HTML
// comments and whitespace, or -1 if this is not such a run.
// Those lines render nothing, so they must stay invisible to the step machinery: they
// may neither absorb a step marker nor pass for the content a leading separator looks
// for, and the empty paragraph markdown makes of them must not take a step slot.
// Comments can span lines (these decks use `</span><!--` / `--><span>` to swallow
// whitespace), so a run counts only when it opens and closes cleanly -- dropping half of
// a comment would leave everything after it commented out.
function comment_only_run_end(lines, start) {
  var in_comment = false;
  var saw_comment = false;

  for (var i = start; i < lines.length; i++) {
    var line = lines[i];
    var j = 0;

    while (j < line.length) {
      if (in_comment) {
        var close = line.indexOf('-->', j);
        if (close === -1) {
          j = line.length;
          break;
        }
        in_comment = false;
        j = close + 3;
        continue;
      }

      if (line.charAt(j) === '<' && line.substr(j, 4) === '<!--') {
        in_comment = true;
        saw_comment = true;
        j += 4;
        continue;
      }

      if (/\S/.test(line.charAt(j))) {
        return -1;
      }
      j++;
    }

    if (!in_comment) {
      // Blank lines are meaningful to markdown, so only a run holding a real comment
      // may be dropped.
      return saw_comment ? i : -1;
    }
  }

  return -1;
}

// Turn bare `--` lines in a macro's content into marker comments.
// Returns { text, leading_steps }: `leading_steps` counts the separators that appear
// before any content, which have no element to attach to and are therefore handled by
// offsetting the whole step walk instead (see render_macro_with_steps).
function inline_step_markers(content, marker) {
  var lines = content.split('\n');
  var output = [];
  var fenceToken = null;
  var leading_steps = 0;

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

    // Drop lines that render nothing but a comment, so a `--` next to them behaves as
    // if they were not written at all.
    if (lines[i].indexOf('<!--') !== -1) {
      var commentRunEnd = comment_only_run_end(lines, i);
      if (commentRunEnd !== -1) {
        i = commentRunEnd;
        continue;
      }
    }

    // Replace `--` with the marker and merge it to the end of the previous line if possible, otherwise keep it as a separate line.
    // This allows step markers to be placed inline in the markdown content without affecting the layout when rendered.
    if (/^--\s*$/.test(lines[i])) {
      var commentMarker = '<!--' + marker + '-->';
      var mergeIndex = -1;
      var sawContent = false;

      for (var j = output.length - 1; j >= 0; j--) {
        if (/^\s*$/.test(output[j])) {
          continue;
        }
        sawContent = true;
        // Avoid appending marker to fence delimiter lines.
        if (!/^\s*(`{3,}|~{3,})/.test(output[j])) {
          mergeIndex = j;
        }
        break;
      }

      if (mergeIndex >= 0) {
        output[mergeIndex] += commentMarker;
      } else if (sawContent) {
        // Right after a fenced block. Surround the marker with blank lines so markdown
        // parses it as a standalone HTML block; without them it is folded into the
        // paragraph that follows and would mark that paragraph as already visible.
        output.push('');
        output.push(commentMarker);
        output.push('');
      } else {
        // No content precedes this separator, so there is nothing for the marker to
        // attach to. Emitting it here does not work: markdown swallows it into the next
        // block, and remark's single-paragraph unwrap drops it entirely. Count it and
        // let the step walk start from a later step instead.
        leading_steps += 1;
      }
      continue;
    }

    output.push(lines[i]);
  }

  return {
    text: output.join('\n'),
    leading_steps: leading_steps
  };
}

function render_macro_with_steps(content, marker)
{
  var markerized = inline_step_markers(content, marker);
  var html = remark.convert(markerized.text);
  var container = document.createElement('div');
  // Separators that preceded all content become the starting step: the macro renders
  // its chrome (a callout's title, say) with an empty body until that step is reached.
  var max_step = markerized.leading_steps;
  var has_markers = max_step > 0 || markerized.text.indexOf('<!--' + marker + '-->') !== -1;

  container.innerHTML = html;

  function walk(node, current_step)
  {
    // `node` itself already carries `current_step`, so its text only needs its own
    // wrapper once a marker has moved the counter past that. The container is the
    // exception: it is not a fragment, so text sitting directly in it has nothing to
    // carry data-step at all -- which is exactly what a plain-prose macro body looks
    // like, since remark unwraps a lone top-level paragraph into bare text nodes.
    var is_container = node === container;
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
      } else if (child.nodeType === 3) {
        if (has_markers && (is_container || step !== current_step) && /\S/.test(child.nodeValue || '')) {
          var span = document.createElement('span');
          set_step_fragment(span, step);
          node.replaceChild(span, child);
          span.appendChild(child);
        }
      } else if (child.nodeType === 1) {
        set_step_fragment(child, step);
        var step_before = step;
        step = walk(child, step);
        if (step !== step_before) {
          drop_if_emptied_by_marker(child);
        }
      }

      child = next;
    }

    return step;
  }

  walk(container, markerized.leading_steps);

  return {
    html: container.innerHTML,
    has_steps: max_step > 0
  };
}

function render_callout_with_steps(content)
{
  return render_macro_with_steps(content, 'CALLSTEP_MARKER');
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

    var rendered = render_macro_with_steps(content, 'OLSTART_STEP_MARKER');
    var html = rendered.html;
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

    if (!rendered.has_steps) {
      return container.innerHTML;
    }

    return '<div class="olstart-step-wrapper has-steps">' + container.innerHTML + '</div>';
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

  var source = document.getElementById('source');
  if (source) {
    source.value = expand_block_step_markers(source.value || source.textContent || '', BLOCK_STEP_MARKER);
    source.value = expand_inline_class_macros(source.value);
    source.textContent = source.value;
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
  init_block_step_divs(slideshow);
  init_print_step_expansion(presentation_config);

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
