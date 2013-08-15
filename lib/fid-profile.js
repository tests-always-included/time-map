// Use a web browser's window.performance.now() if available
// Use node.js's process.hrtime() if available
// fid-umd {"name":"FidProfile","jslint":1,"global":1}
/*global define, YUI*/
(function (n, r, s) {
	"use strict";
	var f = function () { return s.call(r); };
	try { module.exports = f(); return; } catch (a) {}
	try { exports[n] = f(); return; } catch (b) {}
	try { return define.amd && define(n, [], f); } catch (c) {}
	try { return YUI.add(n, function (Y) { Y[n] = f(); }); } catch (d) {}
	try { r[n] = f(); return; } catch (e) {}
	throw new Error("Unable to export " + n);
}("FidProfile", this, function () {
	"use strict";
	// fid-umd end


	var globalObject, referenceTime;


	globalObject = this;


	function FidProfile() {
		if (!(this instanceof FidProfile)) {
			return new FidProfile();
		}

		this.profiles = [];
	}


	FidProfile.prototype.isProfiled = function (fn) {
		var i;

		for (i = 0; i < this.profiles.length; i += 1) {
			if (this.profiles[i].fn === fn) {
				return this.profiles[i];
			}
		}

		return false;
	};


	FidProfile.prototype.findByName = function (name) {
		var i, result;

		result = [];
		for (i = 0; i < this.profiles.length; i += 1) {
			if (this.profiles[i].name === name) {
				result.push(this.profiles[i]);
			}
		}
		return result;
	};


	FidProfile.prototype.functionName = function (fn) {
		var result;

		if (fn.name) {
			return fn.name;
		}

		// Handle embedded comments, newlines, etc
		// See http://stackoverflow.com/questions/517411/extracting-nested-function-names-from-a-javascript-function/546984#546984
		/*jslint regexp:true*/
		result = /^[\s\r\n]*function[\s\r\n]*([^\(\s\r\n]*?)[\s\r\n]*\([^\)\s\r\n]*\)[\s\r\n]*\{((?:[^}]*\}?)+)\}\s*$/.exec(fn.toString());
		/*jslint regexp:false*/

		if (result) {
			return result[1];
		}

		return '';
	};


	if (globalObject.performance && globalObject.performance.now) {
		FidProfile.prototype.getDate = function () {
			return globalObject.performance.now();
		};
	} else if (process && process.hrtime && process.hrtime().length === 2) {
		// Set a reference time so we don't possibly go over our precision limit
		referenceTime = process.hrtime()[0];
		FidProfile.prototype.getDate = function () {
			var t;
			t = process.hrtime();
			return (t[0] - referenceTime) * 1000 + t[1] / 1000000;
		};
	} else {
		FidProfile.prototype.getDate = function () {
			return (new Date()).getTime();
		};
	}


	FidProfile.prototype.log = function (override) {
		var i, list, settings, tempList;

		settings = {
			minAverage: 0,
			minCalls: 0,
			minElapsed: 0,
			reporter: this.logReporter,
			sorter: null
		};

		if (typeof override === 'function') {
			settings.sorter = override;
		} else if (typeof override === 'object') {
			for (i in override) {
				if (override.hasOwnProperty(i)) {
					settings[i] = override[i];
				}
			}
		}

		list = this.profiles.slice(0);

		// Filter the list
		if (settings.minAverage || settings.minCalls || settings.minElapsed) {
			tempList = [];
			for (i = 0; i < list.length; i += 1) {
				if (list[i].average >= settings.minAverage &&
						list[i].calls >= settings.minCalls &&
						list[i].elapsed >= settings.minElapsed) {
					tempList.push(list[i]);
				}
			}
			list = tempList;
		}


		// Sort
		if (settings.sorter) {
			list = list.sort(settings.sorter);
		}

		if (settings.reporter) {
			settings.reporter(list);
		}

		return list;
	};


	FidProfile.prototype.logReporter = function (list) {
		var i, item, line;

		function rounded(what) {
			return (Math.round(what * 100) / 100).toFixed(2);
		}

		for (i = 0; i < list.length; i += 1) {
			item = list[i];
			line = '[' + item.index + '] ' + item.name;
			line += ', ' + item.calls + ', ' + rounded(item.elapsed);
			line += ' (' + rounded(item.average) + ')';
			console.log(line);
		}
	};


	FidProfile.prototype.makeProfile = function (name, fn, original) {
		var profile;

		profile = {
			average: 0,
			calls: 0,
			elapsed: 0,
			fn: fn,
			index: this.profiles.length,
			name: name,
			original: original
		};
		this.profiles.push(profile);

		return profile;
	};


	FidProfile.prototype.profile = function (owner, name, prefix) {
		var target;

		target = owner[name];

		if (typeof target === 'function') {
			if (!prefix) {
				prefix = '';
			}

			this.profileFunction(owner, name, prefix);
			this.profileObject(target.prototype, name + '.prototype');
		} else if (typeof target === 'object' && target) {
			if (!prefix) {
				prefix = name;
			}

			this.profileObject(target, name, prefix);
		}
	};


	FidProfile.prototype.profileFunction = function (target, name, prefix) {
		if (typeof target[name] !== 'function') {
			return;
		}

		if (prefix) {
			prefix += '.';
		}

		target[name] = this.wrapFunction(target[name], prefix + name);
	};


	FidProfile.prototype.profileObject = function (target, prefix) {
		var property;

		for (property in target) {
			if (target.hasOwnProperty(property) && target[property]) {
				this.profileFunction(target, property, prefix);
			}
		}
	};


	FidProfile.prototype.reset = function () {
		var i;

		for (i = 0; i < this.profiles.length; i += 1) {
			this.profiles[i].average = 0;
			this.profiles[i].calls = 0;
			this.profiles[i].elapsed = 0;
		}
	};


	FidProfile.prototype.sortByAverage = function (a, b) {
		return a.average - b.average;
	};


	FidProfile.prototype.sortByCalls = function (a, b) {
		return a.calls - b.calls;
	};


	FidProfile.prototype.sortByElapsed = function (a, b) {
		return a.elapsed - b.elapsed;
	};


	FidProfile.prototype.sortByIndex = function (a, b) {
		return a.index - b.index;
	};


	FidProfile.prototype.sortByName = function (a, b) {
		if (a.name > b.name) {
			return 1;
		}

		if (a.name < b.name) {
			return -1;
		}

		return 0;
	};


	FidProfile.prototype.timeFunctionCall = function (fn, scope, args, callback) {
		var end, returnVal, start;

		callback = callback || function (elapsed) {
			console.log(elapsed);
		};
		scope = scope || null;
		args = args || [];
		start = this.getDate();

		try {
			returnVal = fn.apply(scope, args);
			end = this.getDate();
			callback(end - start);
			return returnVal;
		} catch (ex) {
			end = this.getDate();
			callback(end - start);
			throw ex;
		}
	};


	FidProfile.prototype.wrapFunction = function (original, name) {
		var profile, wrapped, myself;

		if (this.isProfiled(original)) {
			return original;
		}

		myself = this;
		wrapped = function () {
			var args, instance, isConstructor, proto;

			function addElapsed(elapsed) {
				profile.calls += 1;
				profile.elapsed += elapsed;
				profile.average = profile.elapsed / profile.calls;
			}

			function FakeType() {}

			// Test if this is invoked as a constructor
			isConstructor = this instanceof wrapped;
			args = Array.prototype.slice.call(arguments);

			if (!(this instanceof wrapped)) {
				// Simple function call
				return myself.timeFunctionCall(original, this, args, addElapsed);
			}

			// Invoked as a constructor
			if (Object.create) {
				proto = Object.create(original.prototype);
			} else {
				FakeType.prototype = original.prototype;
				proto = new FakeType();
				/*jslint sub:true*/
				proto['__proto__'] = original.prototype;
				/*jslint sub:false*/
			}

			instance = myself.timeFunctionCall(original, proto, args, addElapsed);
			instance = original.apply(proto, args);

			if (typeof instance === 'object' && instance) {
				return instance;
			}

			return proto;
		};
		profile = this.makeProfile(name, wrapped, original);
		wrapped.prototype = original.prototype;
		wrapped.constructor = original.constructor;
		return wrapped;
	};


	return FidProfile;


	// fid-umd post
}));
// fid-umd post-end
