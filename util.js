Array.equal = function (a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length != b.length) return false;

  // If you don't care about the order of the elements inside
  // the array, you should sort both arrays here.

  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
Array.containsArray = function (a, b) {
	for (var i = 0; i < a.length; ++i) {
    	if (Array.equal(a[i], b)) return true;
	}
	return false;
}

Math.randInt = function (min, max) {
	return Math.floor(Math.random() * (max - min)) + min;
};