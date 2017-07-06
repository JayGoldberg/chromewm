CLOSURE_LIBRARY_PATH="../thirdparty/closure-library/"
JS_COMPILER_PATH="../thirdparty/bin/closure-compiler.jar"
EXTERNS="../thirdparty/closure-compiler/contrib/externs/chrome_extensions.js"


background: js/background.js
	echo $(EXTERNS)
