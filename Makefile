NODE=$(shell which node nodejs)
MOCHA=node_modules/mocha/bin/mocha

.PHONY: test

all: test serve

serve: mosto.js ${MOCHA}
	${NODE} mosto.js

install:
	npm install

${MOCHA}: install

test: ${MOCHA}
	${NODE} ${MOCHA}

