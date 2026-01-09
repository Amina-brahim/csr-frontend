
//global variable, for html page, refer tpsvr @ npm.
ele = require("../get-element-by-id.js");

module.exports = {

	"get_element_by_id()": function (done) {
		return ele('divResult') === document.getElementById('divResult') &&
			ele(document.getElementById('divResult')) === document.getElementById('divResult');
	},

};

// for html page
//if (typeof setHtmlPage === "function") setHtmlPage("title", "10em", 1);	//page setting
if (typeof showResult !== "function") showResult = function (text) { console.log(text); }

//for mocha
if (typeof describe === "function") describe('ele_tool', function () { for (var i in module.exports) { it(i, module.exports[i]).timeout(5000); } });
