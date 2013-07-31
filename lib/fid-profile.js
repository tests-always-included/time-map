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


	FidProfile.prototype.log = function (sorter) {
		var i, sorted;

		if (!sorter) {
			sorter = this.sortByName;
		}

		sorted = this.profiles.sort(sorter);

		console.log(['--- Name ---', '--- Calls ---', '--- Elapsed MS ---']);

		for (i = 0; i < sorted.length; i += 1) {
			console.log([sorted[i].name, sorted[i].calls, sorted[i].elapsed]);
		}
	};


	FidProfile.prototype.makeProfile = function (name) {
		var profile;

		profile = {
			name: name,
			calls: 0,
			elapsed: 0
		};
		this.profiles.push(profile);

		return profile;
	};


	FidProfile.prototype.profile = function (owner, name, prefix) {
		var target;

		target = owner[name];

		if (typeof target === 'function') {
			if (prefix) {
				prefix += '.';
			} else {
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
		var fn, profile;

		profile = this.makeProfile(prefix + name);
		fn = target[name];
		target[name] = function () {
			var args, endDate, returnValue, startDate;

			args = Array.prototype.slice.call(arguments);
			profile.calls += 1;
			startDate = new Date();

			try {
				returnValue = fn.apply(this, args);
				endDate = new Date();
				profile.elapsed += endDate - startDate;

				return returnValue;
			} catch (ex) {
				endDate = new Date();
				profile.elapsed += endDate - startDate;

				throw ex;
			}
		};
		target[name].prototype = fn.prototype;
		target[name].constructor = fn.constructor;
	};


	FidProfile.prototype.profileObject = function (target, prefix) {
		var property;

		for (property in target) {
			if (target.hasOwnProperty(property) && target[property]) {
				this.profileFunction(target, property, prefix + '.');
			}
		}
	};


	FidProfile.prototype.sortByCalls = function (a, b) {
		if (a.calls > b.calls) {
			return 1;
		}

		if (a.calls < b.calls) {
			return -1;
		}

		return 0;
	};


	FidProfile.prototype.sortByElapsed = function (a, b) {
		if (a.elapsed > b.elapsed) {
			return 1;
		}

		if (a.elapsed < b.elapsed) {
			return -1;
		}

		return 0;
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


	return FidProfile;


	// fid-umd post
}));
// fid-umd post-end
