from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities

options = Options()
options.add_argument('--headless')
options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})

driver = webdriver.Chrome(options=options)
driver.get("http://localhost:5173/admin")

import time
time.sleep(3)

for entry in driver.get_log('browser'):
    if entry['level'] == 'SEVERE':
        print(f"ERROR: {entry['message']}")

driver.quit()
