EXTENSION_FILES := build.mjs manifest.json icon.png LICENSE mindmap-contract.js popup.css popup.html popup.js $(wildcard formats/* shared/*)

.PHONY: all build chrome firefox clean

all: chrome firefox

build: all

dist/.built: $(EXTENSION_FILES)
	node build.mjs
	touch $@

chrome: dist/.built
	rm -f dist/mindmap-exporter-chrome.zip
	cd dist/chrome && zip -r ../mindmap-exporter-chrome.zip .

firefox: dist/.built
	rm -f dist/mindmap-exporter-firefox.zip
	cd dist/firefox && zip -r ../mindmap-exporter-firefox.zip .

clean:
	rm -rf dist
