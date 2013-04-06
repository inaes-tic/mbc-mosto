NODE=$(shell which node nodejs)
MOCHA=node_modules/mocha/bin/mocha
MELTED=$(shell which melted)

.PHONY: test

all: test serve

serve: mosto.js ${MOCHA}
	${NODE} mosto.js

install:
	npm install

${MOCHA}: install

${MELTED}:
	echo "I can't found melted. Please install it before continue"
	exit -1

videos: test/videos/SMPTE_Color_Bars.avi test/videos/SMPTE_Color_Bars.mp4

test/videos/%.avi: test/images/%.png
	avconv -loop 1 -f image2 -i $< -t 30 $@

test/videos/%.mp4: test/images/%.png
	avconv -loop 1 -f image2 -i $< -t 30 $@

test: videos ${MOCHA} ${MELTED}
	${MELTED}
	-${NODE} ${MOCHA}
	killall melted

