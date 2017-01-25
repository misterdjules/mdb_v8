/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2015, Joyent, Inc.
 */

var common = require('./common');
var assert = require('assert');
var os = require('os');
var path = require('path');
var util = require('util');

var getRuntimeVersions = require('../lib/runtime-versions').getRuntimeVersions;

var RUNTIME_VERSIONS = getRuntimeVersions();
var V8_VERSION = RUNTIME_VERSIONS.V8;

/*
 * Some functions to create a recognizable stack.
 */
var frames = [ 'stalloogle', 'bagnoogle', 'doogle' ];
var expected;

var stalloogle = function (str) {
	expected = str;
	os.loadavg();
};

var bagnoogle = function (arg0, arg1) {
	stalloogle(arg0 + ' is ' + arg1 + ' except that it is read-only');
};

var done = false;

var doogle = function () {
	if (!done)
		setTimeout(doogle, 10);

	bagnoogle('The bfs command', '(almost) like ed(1)');
};

var spawn = require('child_process').spawn;
var prefix = '/var/tmp/node';
var corefile = prefix + '.' + process.pid;
var args = [ '-S', corefile ];

if (process.env.MDB_LIBRARY_PATH && process.env.MDB_LIBRARY_PATH != '')
	args = args.concat([ '-L', process.env.MDB_LIBRARY_PATH ]);

/*
 * We're going to use DTrace to stop us, gcore us, and set us running again
 * when we call getloadavg() -- with the implicit assumption that our
 * deepest function is the only caller of os.loadavg().
 */
var dtrace = spawn('dtrace', [ '-qwn', 'syscall::getloadavg:entry/pid == ' +
    process.pid + '/{stop(); system("gcore -o ' +
    prefix + ' %d", pid); system("prun %d", pid); exit(0); }' ]);

var output = '';
var unlinkSync = require('fs').unlinkSync;

dtrace.stderr.on('data', function (data) {
	console.log('dtrace: ' + data);
});

dtrace.on('exit', function (code) {
	if (code != 0) {
		console.error('dtrace exited with code ' + code);
		process.exit(code);
	}

	done = true;

	/*
	 * We have our core file.  Now we need to fire up mdb to analyze it...
	 */
	var mdb = spawn('mdb', args, { stdio: 'pipe' });

	var mod = util.format('::load %s\n', common.dmodpath());
	mdb.on('exit', function (code2) {
		var retained = '; core retained as ' + corefile;

		if (code2 != 0) {
			console.error('mdb exited with code ' + code2 +
			    retained);
			process.exit(code2);
		}

		var sentinel = 'js:     ';
		/*
		 * Starting with V8 5.1.x.y, function definitions of the
		 * following form:
		 *
		 * var foo = function () {}
		 *
		 * don't have an inferred name, but instead an actual name. As
		 * a result,
		 * their representation doesn't include the "<anonymous> as "
		 * prefix.
		 */
		if (V8_VERSION.major < 5 ||
		    (V8_VERSION.major === 5 && V8_VERSION.minor < 1)) {
			sentinel += '<anonymous> (as ';
		}

		var arg1 = '          arg1: ';
		var lines = output.split('\n');
		var matched = 0;
		var straddr = undefined;

		for (var i = 0; i < lines.length; i++) {
			var line = lines[i];

			if (matched == 1 && line.indexOf(arg1) === 0) {
				straddr =
				    line.substr(arg1.length).split(' ')[0];
			}

			if (line.indexOf(sentinel) == -1 ||
			    frames.length === 0)
				continue;

			var frame = line.substr(line.indexOf(sentinel) +
			    sentinel.length);
			var top = frames.shift();

			assert.equal(frame.indexOf(top), 0,
			    'unexpected frame where ' +
			    top + ' was expected' + retained);

			matched++;
		}

		assert.equal(frames.length, 0, 'did not find expected frame ' +
		    frames[0] + retained);

		assert.notEqual(straddr, undefined,
		    'did not find arg1 for top frame' + retained);

		/*
		 * Now we're going to take one more swing at the core file to
		 * print out the argument string that we found.
		 */
		output = '';
		mdb = spawn('mdb', args, { stdio: 'pipe' });

		mdb.on('exit', function (code3) {
			if (code3 != 0) {
				console.error('mdb (second) exited with code3 '
				    + code3 + retained);
				process.exit(code3);
			}

			assert.notEqual(output.indexOf(expected), -1,
			    'did not find arg1 (' + straddr +
			    ') to contain expected string' + retained);

			unlinkSync(corefile);
			process.exit(0);
		});

		mdb.stdout.on('data', function (data) {
			output += data;
		});

		mdb.stderr.on('data', function (data) {
			console.log('mdb (second) stderr: ' + data);
		});

		mdb.stdin.write(mod);
		mdb.stdin.write(straddr + '::v8str\n');
		mdb.stdin.end();
	});

	mdb.stdout.on('data', function (data) {
		output += data;
	});

	mdb.stderr.on('data', function (data) {
		console.log('mdb stderr: ' + data);
	});

	mdb.stdin.write(mod);
	mdb.stdin.write('::jsstack -v\n');
	mdb.stdin.end();
});

setTimeout(doogle, 10);
