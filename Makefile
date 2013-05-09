ROOT=$(shell pwd)
NODE=$(shell which node nodejs | head -1)
MOCHA=node_modules/mocha/bin/mocha --reporter spec --timeout 30000 test
MELTED_BUILD=${ROOT}/melted/BUILD
MELTED_INTREE=${MELTED_BUILD}/bin/melted
MELTED = $(shell sh -c "which melted || echo ${MELTED_INTREE}")
NC=$(shell which nc netcat telnet | head -1)
TEST_VIDEOS=test/videos/SMPTE_Color_Bars_01.mp4 test/videos/SMPTE_Color_Bars_02.mp4 test/videos/SMPTE_Color_Bars_03.mp4

export NODE_CONFIG_DIR ?= $(PWD)/node_modules/mbc-common/config

.PHONY: test

all: test serve

serve: melted-check mosto.js server.js
	${NODE} server.js

install:
	npm install

${MOCHA}: install

ifeq (${MELTED}, ${MELTED_INTREE})
${MELTED}: melted
	cd melted && mkdir -p BUILD && ./configure --enable-gpl --prefix=${MELTED_BUILD} && make && make install

melted:
	git clone git://github.com/mltframework/melted.git

melted-run:
	LD_LIBRARY_PATH=${LD_LIBRARY_PATH}:${MELTED_BUILD}/lib ${MELTED}

else
${MELTED}:
	echo "ERROR: melted can't be found."
	echo "Please install it or set the MELTED env variable to it's executable path."
	echo "eg: \$ MELTED=/usr/local/bin/melted make"
	exit -1

melted-run:
	${MELTED}
endif

melted-kill:
	-killall -9 melted

melted-restart: ${MELTED} melted-kill melted-run
	m4 -DROOT=${ROOT} test/melted_setup.txt | ${NC} localhost 5250

melted-check: ${MELTED}

images: test/images/SMPTE_Color_Bars_01.png test/images/SMPTE_Color_Bars_02.png test/images/SMPTE_Color_Bars_03.png

%.png: test/images/SMPTE_Color_Bars.png
	cp $< $@

videos: test/videos/SMPTE_Color_Bars_01.mp4 test/videos/SMPTE_Color_Bars_02.mp4 test/videos/SMPTE_Color_Bars_03.mp4


test/videos/%.avi: test/images/%.png
	avconv -loop 1 -f image2 -i $< -t 30 $@ &> /dev/null

test/videos/%.mp4: test/images/%.png
	melt $< in=0 out=750 -consumer avformat:$@ acodec=none

test: videos ${MOCHA} melted-check
	${NODE} ${MOCHA}

clean-test:
	rm ${TEST_VIDEOS}
