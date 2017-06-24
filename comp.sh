#!/bin/bash
# With jar compiler

COMPILER="java -jar ../thirdparty/bin/closure-compiler.jar"
BASICS="\
--compilation_level ADVANCED \
--js_output_file bin/background3.js \
"

EXTRAS="\
--externs closure-library/closure/goog/**.js \
--js !closure-library/closure/goog/**test.js \
--js background3.js \
"
#--dependency_mode=STRICT --entry_point=chromesnap.background \
BUILD_COMMAND="$COMPILER $BASICS $EXTRAS"
echo $BUILD_COMMAND
eval $BUILD_COMMAND
# --js ../thirdparty/closure-library/closure/goog/base.js \
# --js ../thirdparty/closure-library/closure/goog/string/string.js \
