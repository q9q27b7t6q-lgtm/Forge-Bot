(function () {
  document.documentElement.classList.add('js');
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('siteNav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  var header = document.getElementById('siteHeader');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 12);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Always show reveal content immediately (auth forms must never stay opacity 0)
  var nodes = document.querySelectorAll('.reveal, .card.glass, .cta-band, .page-hero');
  for (var i = 0; i < nodes.length; i++) nodes[i].classList.add('is-in');
})();
