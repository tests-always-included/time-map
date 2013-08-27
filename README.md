FidProfile - JavaScript Profiling
=================================

There are better tools, such as Chrome's built-in profiler and debugging through node.js.  When those advanced things are not at your disposal, you must rely on something.  For instance, there could be some code in your application that is causing drastic performance problems in Internet Explorer 8.  What can you do?  Manual profiling.


Getting Started
---------------

First you need to have the `FidProfile` object available.  You need to load `lib/fid-profile.js` and you can do that in several ways:

### Web Browser

Just put the JavaScript file into somewhere that you can serve and include a script tag.  Next you will need to make a profiler object.  To make things simpler, I've created `add-to-browser.js` that does this for you, but you are welcome to do that yourself.

```
<script src="...your...path.../fid-profile.js"></script>
<script src="...your...path.../add-to-browser.js"></script>
```

Lastly, start profiling functions, objects, and more.

```
window.fidProfile.profile(myObject);
window.fidProfile.log();
```

### Web Browser with Module Loader

FidProfile uses [FidUmd] to make a universal module format.  You should be able to load it dynamically with your preferred system and have it available.

### node.js module

First, in your `package.json` file, add a dependency or devDependency on "fid-profile".  Next, use this code to create an instance and start profiling.

```
var FidProfile = require('fid-profile');
var fidProfile = new FidProfile();  // Makes an instance
fidProfile.profile(myObject);
fidProfile.log();
```

### Other systems

FidProfile uses [FidUmd] so the library should be loadable in your preferred JavaScript environment in whatever way you normally load code.


Typical Usage
-------------

For this example, I will assume that the `fidProfile` variable contains an instance of FidProfile.

```
// Profile just a function as "someFunction"
var fn = function () {};
fn = fidProfile.wrapFunction(fn, 'someFunction');

// Profile every function on an object as "MyObject"
var obj = {
    a: function () {}
};
fidProfile.profileObject(obj, "MyObject");

// Profile every function actually on an instance.
// Does not profile functions on its prototype!
var coordSystem = new CoordinateSystem()
fidProfile.profile(coordSystem)

// Profile a constructor, node.js
// This will also get functions on its prototype
var libraries = {
    MyLibrary = require('MyLibrary')
};
fidProfile.profile(libraries, 'MyLibrary');
var lib = new libraries.MyLibrary();
// The constructor was profiled and all methods will be as well.

// Report everything to console
fidProfile.log();

// Report long stuff to console sorted by number of calls
fidProfile.log({
    minElapsed: 1000,  // 1 second
    sorter: fidProfile.sortByCalls
});
```


How it Works
------------

Functions are wrapped with an anonymous function that will start a timer and pass on arguments to the real function.  The real one will finish and the returned value or thrown exception is remembered.  The timer is stopped and a little housekeeping is performed in order to keep the logs up to date, then the wrapper will return or throw the exception.  It's all transparent.

This also detects if you are creating an object instance automatically and returns the appropriate thing in those cases.

When profiling a function, it will be replaced with a wrapped function.  If it has a prototype, all functions on that prototype will be profiled as well.  Those prototype functions will be replaced by the wrapped version.  The profiling does not continue up the prototype chain.

When profiling an object, each property that is a function will be profiled and the wrapped function will replace the original property.

Timing is done with a high resolution timer (`performance.now()` for Chrome, `process.hrtime()` for node.js) or by constructing `Date` objects.  Please be aware that Internet Explorer's `Date` object's time resolution is limited and can't get down to the millisecond ([more information](http://www.merlyn.demon.co.uk/js-dates.htm#OV)).

API Documentation
-----------------

### new FidProfile()

Returns a FidProfile instance.  There's no configuration.

### FidProfile.prototype.isProfiled(fn)

Returns false if the function passed in has not been profiled.  If it is in the list of profiled functions, the profile object is returned.  The profile object is detailed under `makeProfile`.

### FidProfile.prototype.findByName(name)

Returns an array of all profiles with the associated name.  Can be an empty array.  Profile objects are detailed under `makeProfile`.  This is a convenience function for you as it isn't used by this library, but it is fitting and could easily be adopted into your own reporters.

### FidProfile.prototype.functionName(fn)

Returns the name of a given function.  If the `name` property is not set, the function will be cast to a string and tested against a pattern to see if there was a name given when it was created.  If no name is available, this returns an empty string.

### FidProfile.prototype.getDate()

Returns a timestamp used for timing functions.  This should be a very fast function and as accurate as possible.  It returns times in milliseconds.  Times do not need to be from any given starting point, which means that it might return 0 for the first invocation, but will always return the elapsed time when used like `endTime - startTime`.

### FidProfile.prototype.log(override)

Logs all profiled information.  When passing a function for `override`, it will use that function for reporting.  Otherwise, `override` can be an object that will be used to change any of these default settings:

```
defaultSettings = {
    // Profile filters
    minAverage: 0,
    minCalls: 0,
    minElapsed: 0,
    
    // Reporting
    reporter: this.logReporter,
    sorter: null
}
```

The filters determine what profiles get reported.  You might profile everything in your app but may only be interested in things that get called over 250,000 times.  Average is the total elapsed time divided by the number of times it was called.

The `reporter` setting defaults to `logReporter`, and is the way the profiles are reported back to you.  You can override the function so that results are not sent to the console or so they are presented differently.  The `sorter` setting can be a function that will accept two profile objects and will sort them to be in the order most beneficial to you.  There's a couple included in `FidProfile`.

### FidProfile.prototype.logReporter(profileList)

`profileList` is an array of profile objects.  Profile objects are detailed under `makeProfile`.  This function is responsible for displaying the list of profiles somehow.  The default one will just `console.log()` the list in a somewhat readable form.

### FidProfile.prototype.makeProfile(name, fn, original)

Creates a new profile object with the right properties initialized.  Properties are listed here:

```
profileObject = {
    average: number,  // Merely calls/elapsed
    calls: number,  // How many times the wrapper was called
    elapsed: number,  // Total elapsed time
    fn: Function,  // Wrapper function
    index: number,  // Index in the fidProfile.profiles array
    name: string,  // Name used when setting up the profile
    original: Function  // Original function, unwrapped
}
```

### FidProfile.prototype.profile(owner, name, prefix)

Profile an object or function.  If profiling a function and it has a `prototype` property (ie. a constructor), each function listed there will be profiled as well.  Objects will be scanned and all properties that are functions will be profiled.

`owner` is the object that holds the function you wish to profile.  If you are dealing with global functions, you can often use `window` or `this` in place of owner.  `name` is the name of the property on `owner` that contains the function.  `prefix` is the prefix, if any, to assign to the profiled name.  Here's some examples:

```
window.TestObject = function () {};
window.TestObject.prototype.aaa = function () {};
fidProfile(window, 'TestObject');

window.bbbb = function () {};
fidProfile(window, 'bbbb', 'sampleThing');
```

This will replace `window.TestObject` with a wrapped version and that will report automatically as "TestObject" as that's the `name` parameter.  It also replaces `window.TestObject.prototype.aaa` with a different wrapped function and profiles it as "TestObject.prototype.aaa".  

Likewise, `window.bbbb` is replaced with a wrapped version.  It's different because it will be reported as "sampleThing".  If it had functions on its prototype, they would have been reported as "sampleThing.prototype.*".

### FidProfile.prototype.profileFunction(target, name, prefix)

This isn't really intended to be called from outside the library as `profile` would call this for you.  `target`, `name` and `prefix` are all the same as `profile`.

### FidProfile.prototype.profileObject(target, prefix)

Profile every property on an object if it is a function.  `target` is the object in question.  `prefix` is an optional prefix to add for the logging.

```
var myObject = {
    a: function () {},
    bbb: function () {}
};
/// I will profile this as the "ZZZzZZZ" object
fidProfile.profileObject(myObject, "ZZZzZZZ");
// Profiles "a" as "ZZZzZZZ.a"
// Profiles "bbb" as "ZZZzZZZ.bbb"
```

### FidProfile.prototype.reset()

Clear out the accumulated counters for all profiles.  This resets the number of calls, elapsed time and average time.

### FidProfile.prototype.sortByAverage(a, b)

Sorts profiles by their average time.  Higher numbers are reported later.

### FidProfile.prototype.sortByCalls(a, b)

Sorts profiles by the number of times they were called.  Higher numbers are reported later.

### FidProfile.prototype.sortByElapsed(a, b)

Sorts profiles by the total amount of elapsed time.  Higher numbers are sorted later.

### FidProfile.prototype.sortByIndex(a, b)

Sorts profiles by their placement in the `profiles` array.

### FidProfile.prototype.sortByName(a, b)

Sorts profiles alphabetically, case sensitive.

### FidProfile.prototype.timeFunctionCall(fn, scope, args, callback) {

Starts a timer, calls the original function, stops the timer, then calls the callback.  `fn` is the original function.  `scope` is what should be used for `this` in the function call.  `args` is an array, which is likely a copy of `arguments` to a wrapped function.  `callback` is a reporting function that is passed only the elapsed time.

### FidProfile.prototype.wrapFunction(original, name) {

Wrap the `original` function in another that will pass on arguments, pass back the returned value, rethrow exceptions and even handle being invoked as a constructor.  This wrapped function will also log to a new profile that is given the name of `name`.

Returns the wrapped function.

### FidProfile.prototype.wrapFunctionOnce(original, name) {

Determines if this function was profiled already.  If so, returns the original profile's wrapped function.

If not already profiled, this calls `wrapFunction` and passes back the results.


Gotchyas
--------

Because the functions are replaced only at the time of profiling, it is possible for them to be overridden or not called.  Consider this code:

```
window.a = function () {};  // First
fidProfile(window, 'a');
// window.a is now the profiling-wrapped version
var oldA = window.a;
window.a = function () { oldA(); oldA(); oldA() };
// Overridden

window.a();  // Only one call here
fidProfile.log();
// Looks like three calls were made
```


License
-------

FidProfile is released under an MIT license with an additional non-advertising clause.  Check the repository for the full text.

[FidUmd]: https://github.com/fidian/fid-umd