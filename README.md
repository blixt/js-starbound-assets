Starbound Assets
================

Manage Starbound assets.


Example
-------

Here's how you might use this package to extract a sound from the
assets file:

```js
var starbound = require('starbound-assets');

// Create an assets manager which will deal with package files etc. It
// will create a worker, which means you need to point it to where the
// worker.js file is stored.
var assets = new starbound.AssetsManager({workerPath: 'worker.js'});

// Assume file is a File object pointing to `assets/packed.pak`.
var file = ...;

// Load up the assets package and play a sound from it.
assets.addFile(file, function () {
  // Welcome to the jungle!
  var sound = '/sfx/environmental/jungle_day.ogg';
  assets.getBlobURL(sound, function (err, url) {
    var audio = new Audio();
    audio.autoplay = true;
    audio.src = url;
    document.body.appendChild(audio);
  });
});
```
