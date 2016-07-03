# Barcode-scanner.JS

Barcode-scanner.JS is a Javascript library that provide implementation of Magnetic stripe/barcode USB and PS/2 scanners.
It's detects when user use a magnetic stripe or barcode scanner, and call specific callbacks.


### How it's works

At the core Barcode-scanner.JS intercepts key press events and if they occur with high frequency stores them in buffer,
and then analyzes and provides the developer with the processed result.
As a bonus library hides the flow of events associated with the operation of the scanner using
*(hiding does not lead to loss of a single control and numeric chars - library repeated event and modify input elements text)*.


### How to use

When using Barcode-scanner.JS you just have to define the event handler that should be called
when scanner is been used *(error and receive handler are not mandatory)* to [initialize](#initialization) library like:

```javascript
scanner.oncomplete = function (data) {
  // Successful scanning
};
scanner.onerror = function (data) {
  // Unsuccessful scanning
};
scanner.onreceive = function (event) {
  // Receiving the next char during scanning
};
```

or

```javascript
scanner (oncomplete, onerror, onreceive);

function oncomplete (data) { }
function onerror (data) { }
function onreceive (event) { }
```

**Complete** and **error** event handlers obtained decoded object `data` with the result of the scan:

* successful **barcode** scanning

  ```javascript
  {
    raw: "5901234123457",     // Raw data
    barcode: {
      present: true,          // Barcode present mark
      valid: true,            // (reserved, always true) Barcode is valid
      code: "5901234123457",  // Barcode without any prefix of postfix
      type: ""                // (reserved, always empty string) Barcode type
    },
    magneticStripe: {
      present: false,
      valid: true,
      track1: "",
      track2: "",
      track3: ""
    }
  }
  ```

* successful **magnetic stripe** scanning

  ```javascript
  {
    raw: "5901234123457",  // Raw data
    barcode: {
      present: false,
      valid: true,
      code: "",
      type: ""
    },
    magneticStripe: {
      present: true,       // Magnetic stripe present mark
      valid: true,         // Magnetic stripe is valid
      track1: "",          // Track #1 without any prefix of postfix if present
      track2: "",          // Track #2 without any prefix of postfix if present
      track3: ""           // Track #2 without any prefix of postfix if present
    }
  }
  ```

* **unsuccessful** scanning

  ```javascript
  {
    error: new Error ("Error message"),  // Error description
    raw: "FOO",                          // Raw data
    barcode: {                           // Filling depends on scanning data and error severity
      present: false,
      valid: true,
      code: "",
      type: ""
    },
    magneticStripe: {                    // Filling depends on scanning data and error severity
      present: true,
      valid: false,
      track1: "",
      track2: "FOO",
      track3: ""
    }
  }
  ```
  
  Possible error messages:
  - Empty dataset
  - Dataset not recognized
  - Magnetics stripe: incorrect track #1
  - Magnetics stripe: incorrect track #2
  - Magnetics stripe: incorrect track #3
  - Magnetics stripe: unexpected data

**Receive** event handler obtained default key press event object `event`.


### <a name="options"></a> Options

For fine-tune you can additionally config next properties of `scanner`:

* `enabled` {Boolean} - Scanner tracking enabling. Default: **true**.
* `oncomplete` {Function} - Successful scanning event (callback).
* `onerror` {Function} - Unsuccessful scanning event (callback).
* `onreceive` {Function} - Next char receiving event during scanning (callback).
* `schema` {Object} - Raw data decoding [schema](#schema).
* `sensitivity` {Number} - Time (in ms) between two chars when user using scanner. Used to do track difference between keyboard typing and scanning. Default: **30** ms.
* `preventDefault` {Boolean} - Prevent default action on key press event. Default: **true**.
* `stopPropagation` {Boolean} - Immediately stop propagation on key press event. Default: **true**.


###  <a name="initialization"></a> Initialization

Library provides three ways for initialization:
* events only set

  **scaner (oncomplete, [onerror], [onreceive])**

  ```javascript
  scanner (oncomplete, onerror, onreceive);
    
  function oncomplete (data) { }
  function onerror (data) { }
  function onreceive (event) { }
  ```

* events and DOM element tracking set

  **scaner (target, [oncomplete], [onerror], [onreceive])**

  where `target` is DOM element or jQuery object that will limit library in taking scanner. By default library taking scanner through `window`.

  ```javascript
  target = $( "#order-form" );
  
  scanner (target, oncomplete, onerror, onreceive);
    
  function oncomplete (data) { }
  function onerror (data) { }
  function onreceive (event) { }
  ```

* [options](#options) and DOM element tracking set

  **scaner (options)**

  ```javascript
  schema = new scanner.Schema ();
  schema.barcode.startSentinel = ";";
  schema.barcode.endSentinel = "\\?";

  scanner ({
    target: $( "#order-form" ),
    oncomplete: oncomplete,
    onerror: onerror,
    onerror: onerror,
    schema: schema,
    sensitivity: 50,
    preventDefault: false,
    stopPropagation: false
  });
    
  function oncomplete (data) { }
  function onerror (data) { }
  function onreceive (event) { }
  ```

###  Decode

Method `scanner.Decode` allows analise and validate raw string contained barcode or magnetic stripe data. With default

```javascript
data = new scanner.Decode ("%ALEXANDER_PEREVERZEV?");
```

or special analysing scheme

```javascript
schema = new scanner.Schema ();
schema.barcode.startSentinel = ";";
schema.barcode.endSentinel = "\\?";

data = new scanner.Decode (";5901234123457?", schema);
```

### <a name="schema"></a> Schema

Object created by `scanner.Schema` describing schema for decoding raw data.
Default schema:

```javascript
{
  barcode: {
    listen: true,                  // Barcode expected mark
    startSentinel: "",             // Beginning symbol
    endSentinel: "",               // Ending symbol
    LRC: "(?:(?:\\r\\n)|\\n|\\r)"  // Data set ending character
  },
  magneticStripe: {
    listen: true,                  // Magnetic stripe expected mark
    track1: {
      startSentinel: "%",          // I-track beginning symbol
      endSentinel: "\\?",          // I-track ending symbol
    },
    track2: {
      startSentinel: ";",          // II-track beginning symbol
      endSentinel: "\\?",          // II-track ending symbol
    },
    track3: {
      startSentinel: "_",          // III-track beginning symbol
      endSentinel: "\\?",          // III-track ending symbol
    },
    LRC: "(?:(?:\\r\\n)|\\n|\\r)"  // Traks and data set ending character
  }
}
```

###  Validation

Decoder validate magnetic stripe data based on accepted standarts:
* I-track:
    - valid characters: QWERTYUIOPASDFGHJKLZXCVBNM0123456789:;=+()–‘"!@#^&*<>/\
    - length: 76 symbols
    - line beginning: %
    - line ending: ?
* II-track:
    - valid characters: 0123456789=
    - length: 37 symbols
    - line beginning: ;
    - line ending: ?
* III-track:
    - valid characters: 0123456789=
    - length: 104 symbols
    - line beginning: _
    - line ending: ?

Barcode validation not supported yet :(


###  Browser support

- Internet Explorer 7+
- Firefox 3+
- Opera 12+
- Safari
- Google Chrome

###  License
Barcode-scanner.JS is distributed under the MIT license. Please keep the existing headers.

###  Attribution
Developer Alexander Pereverzev - <a.v.pereverzev@gmail.com>

Using borrowings from projects

* [Textarea Cursor Position in Internet Explorer](http://linebyline.blogspot.com/2006/11/element-cursor-position-in-internet.html) - (C) 2006 Jake Roberts
* [crossBrowser_initKeyboardEvent.js](https://gist.github.com/termi/4654819) - (C) 2013 Егор Халимоненко