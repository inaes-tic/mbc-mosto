NODE=$(shell which node nodejs | head -1)
MOCHA=node_modules/mocha/bin/mocha
MELTED=$(shell which melted | head -1)
ROOT=$(shell pwd)
NC=$(shell which nc netcat telnet | head -1)
AVCONV=$(shell which avconv ffmpeg | head -1)
TEST_VIDEOS=test/videos/SMPTE_Color_Bars_01.mp4 test/videos/SMPTE_Color_Bars_02.mp4 test/videos/SMPTE_Color_Bars_03.mp4

.PHONY: test

all: test serve

serve: mosto.js ${MOCHA}
	${NODE} mosto.js

install:
	npm install

${MOCHA}: install

${MELTED}:
	echo "ERROR: melted can't be found."
	echo "Please install it or set the MELTED env variable to it's executable path."
	echo "eg: \$ MELTED=/usr/local/bin/melted make"
	exit -1

test/videos/SMPTE_Color_Bars_%.mp4:  test/images/SMPTE_Color_Bars.png
	${AVCONV} -loop 1 -f image2 -i $< -t 30 $@ &> /dev/null

test: ${TEST_VIDEOS} ${MOCHA} ${MELTED}
	${MELTED}
	m4 -DROOT=${ROOT} test/melted_setup.txt | ${NC} localhost 5250
	-${NODE} ${MOCHA}
	killall melted

clean-test:
	rm ${TEST_VIDEOS}
