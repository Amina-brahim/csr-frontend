# get-element-by-id
enclose document.getElementById()

# Install
```
npm install get-element-by-id
```

# Usage & Api
```javascript

ele = require("get-element-by-id");

//ele(idOrEl)
ele('divResult') === document.getElementById('divResult') &&
	ele(document.getElementById('divResult')) === document.getElementById('divResult');

```
