NODE=$(shell which node nodejs | head -1)
MOCHA=node_modules/mocha/bin/mocha
MELTED=$(shell which melted | head -1)
ROOT=$(shell pwd)
NC=$(shell which nc netcat telnet | head -1)

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

images: test/images/SMPTE_Color_Bars_01.png test/images/SMPTE_Color_Bars_02.png test/images/SMPTE_Color_Bars_03.png 

%.png: test/images/SMPTE_Color_Bars.png 
	cp $< $@

videos: test/videos/SMPTE_Color_Bars_01.mp4 test/videos/SMPTE_Color_Bars_02.mp4 test/videos/SMPTE_Color_Bars_03.mp4


test/videos/%.avi: test/images/%.png
	avconv -loop 1 -f image2 -i $< -t 30 $@ &> /dev/null

test/videos/%.mp4: test/images/%.png
	avconv -loop 1 -f image2 -i $< -t 30 $@ &> /dev/null

test: videos ${MOCHA} ${MELTED}
	${MELTED}
	m4 -DROOT=${ROOT} test/melted_setup.txt | ${NC} localhost 5250
	-${NODE} ${MOCHA}
	killall melted

