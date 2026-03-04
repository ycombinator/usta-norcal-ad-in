ext:
	cd src/ && zip -r usta-norcal-ad-in.zip . && mv usta-norcal-ad-in.zip .. && cd -
	rm -rf ext && unzip -q usta-norcal-ad-in.zip -d ext

clean:
	rm usta-norcal-ad-in.zip
	rm -rf ext
