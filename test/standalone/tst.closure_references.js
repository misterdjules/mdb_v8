var functionsWithClosureList = [];

function Foo() {
	this.foo = true;
}

function createClosureFunction() {
	var foo = new Foo();

	return function functionWithClosure() {
		console.log(foo);
	}
}

functionsWithClosureList.push(createClosureFunction());

process.abort();
