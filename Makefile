ROOT=$(shell pwd)
NODE=$(shell which node nodejs | head -1)
MOCHA_BIN=node_modules/mocha/bin/mocha
MOCHA_ARGS=--reporter spec --timeout 30000
MOCHA_DEBUG=${MOCHA_BIN} --debug-brk ${MOCHA_ARGS} test
MOCHA=${MOCHA_BIN} ${MOCHA_ARGS} test
COVERAGE=node_modules/.bin/istanbul cover
MELTED_BUILD=${ROOT}/melted/BUILD
MELTED_INTREE=${MELTED_BUILD}/bin/melted
MELTED = $(shell sh -c "which melted || echo ${MELTED_INTREE}")
MELT=$(shell which melt | head -1)
NC=$(shell which nc netcat telnet | head -1)
TEST_VIDEOS=test/videos/SMPTE_Color_Bars_01.mp4 test/videos/SMPTE_Color_Bars_02.mp4 test/videos/SMPTE_Color_Bars_03.mp4
TEST_LENGTHS=200 400 800 1600 3200 6400
TEST_XMLS=$(foreach frames, $(TEST_LENGTHS), test/videos/Bars-$(frames).xml)
MELT_TIME_FILTER=-filter dynamictext:"\#frame\#/\#out\#" halign=centre valign=middle \
                         fgcolour=white size=72 pad=1 geometry=0%/-42:100%x100%:100 \
                 -filter dynamictext halign=centre valign=middle fgcolour=white size=72 \
                         geometry=0%/43:100%x100%:100 pad=1

export NODE_CONFIG_DIR ?= $(PWD)/node_modules/mbc-common/config
LOG_LEVEL ?= info

.PHONY: test

all: test serve

serve: melted-check mosto.js server.js
	@LOG_LEVEL=${LOG_LEVEL} ${NODE} server.js

debug: melted-check mosto.js server.js
	${NODE} --debug-brk server.js


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

videos: ${TEST_VIDEOS} ${TEST_XMLS}

test/videos/Bars-%.xml: test/images/SMPTE_Color_Bars.png
	${MELT} $< out=$* ${MELT_TIME_FILTER} -consumer xml:$@

test/videos/%.mp4: test/images/%.png
	${MELT} $< in=0 out=750 -consumer avformat:$@ acodec=none

test: videos ${MOCHA} melted-check
	@NODE_ENV=test NODE_CONFIG_DIR=$(PWD)/test/config/ ${NODE} ${MOCHA}

coverage: videos melted-check
	@NODE_ENV=test NODE_CONFIG_DIR=$(PWD)/test/config/ ${COVERAGE} ./node_modules/.bin/_mocha -- ${MOCHA_ARGS}

debug-test: videos melted-check
	@NODE_ENV=test NODE_CONFIG_DIR=$(PWD)/test/config/ ${NODE} ${MOCHA_DEBUG}

clean-test:
	rm ${TEST_VIDEOS} ${TEST_XMLS}

