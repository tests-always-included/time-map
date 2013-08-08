// Use a web browser's window.performance.now() if available
/*global window*/
// fid-umd {"name":"FidProfile","jslint":1}
/*global define, YUI*/
(function (n, r, f) {
	"use strict";
	try { module.exports = f(); return; } catch (a) {}
	try { exports[n] = f(); return; } catch (b) {}
	try { return define.amd && define(n, [], f); } catch (c) {}
	try { return YUI.add(n, function (Y) { Y[n] = f(); }); } catch (d) {}
	try { r[n] = f(); return; } catch (e) {}
	throw new Error("Unable to export " + n);
}("FidProfile", this, function () {
	"use strict";
	// fid-umd end


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


	FidProfile.prototype.getDateCallback = function () {
		if (window && window.performance && window.performance.now) {
			return function getDateCallbackNow() {
				return window.performance.now();
			};
		}

		return function getDateCallbackDateTime() {
			return (new Date()).getTime();
		};
	};


	FidProfile.prototype.log = function (override) {
		var i, list, settings, tempList;

		settings = {
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
		if (settings.minElapsed || settings.minCalls) {
			tempList = [];
			for (i = 0; i < list.length; i += 1) {
				if (list[i].elapsed >= settings.minElapsed &&
						list[i].calls >= settings.minCalls) {
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

		for (i = 0; i < list.length; i += 1) {
			item = list[i];
			line = '[' + item.index + '] ' + item.name;
			line += ', ' + item.calls + ', ' + Math.toFixed(item.elapsed, 2);
			line += ' (' + Math.toFixed(item.elapsed / item.calls, 2) + ')';
			console.log(line);
		}
	};


	FidProfile.prototype.makeProfile = function (name, fn, original) {
		var profile;

		profile = {
			name: name,
			calls: 0,
			elapsed: 0,
			fn: fn,
			original: original,
			index: this.profiles.length
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

			this.profileObject(target.prototype, name, prefix);
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
			this.profiles[i].calls = 0;
			this.profiles[i].elapsed = 0;
		}
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


	FidProfile.prototype.wrapFunction = function (original, name) {
		var getDate, profile, wrapped;

		if (this.isProfiled(original)) {
			return original;
		}

		getDate = this.getDateCallback();
		wrapped = function () {
			var args, endDate, instance, isConstructor, proto, returnValue, startDate;

			function FakeType() {}


			// Test if this is invoked as a constructor
			isConstructor = this instanceof wrapped;
			args = Array.prototype.slice.call(arguments);
			profile.calls += 1;
			startDate = getDate();

			try {
				if (this instanceof wrapped) {
					if (Object.create) {
						proto = Object.create(original.prototype);
					} else {
						FakeType.prototype = original.prototype;
						proto = new FakeType();
						/*jslint sub:true*/
						proto['__proto__'] = original.prototype;
						/*jslint sub:false*/
					}
					instance = original.apply(proto, args);
					returnValue = proto;

					if (typeof instance === 'object' && instance) {
						returnValue = instance;
					}
				} else {
					returnValue = original.apply(this, args);
				}

				endDate = getDate();
				profile.elapsed += endDate - startDate;

				return returnValue;
			} catch (ex) {
				endDate = getDate();
				profile.elapsed += endDate - startDate;

				throw ex;
			}
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
