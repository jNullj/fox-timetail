## fox-timetail

Fox-TimeTail, tailing your work-time, is a webapp (with a planned Android Wear app as well) that aims to provide an easy way to track work hours.

features:
- [x] clock in and out in a sipmle UI
    - [x] clock in
    - [x] clock out
    - [x] display status and daily total
- [x] display history - currently only basic month values are displayed
    - [x] display history for the current month
    - [x] display history for previous months
    - [x] display history for a specific day
    - [x] display total hours for the current month (history view)
    - [ ] display total hours  for this month on the main page
- [ ] display statistics
- [ ] add breaks
- [ ] add sick days and vacation days
    - [ ] set balance
    - [ ] set the gain per month
    - [ ] display balance
- [ ] add notes
- [x] webapp for mobile and desktop
- [ ] offline mode - WIP
    - [x] store requests and send them when online
    - [ ] store data locally
    - [ ] display status when offline
    - [ ] display connection status indication
- [ ] export formats: TBD
- [ ] import fromats: TBD
- [ ] multi-user support:
    - [ ] login
    - [ ] per user settings
        - [ ] work hours per day
        - [ ] current sick days and vacation days
        - [ ] sick and vacation gain per month 
    - [ ] per user history files
- [ ] statistics: TBD

## Screenshots

TBD

## Project directory structure

```
fox-timetail/web - webapp
```

## web server installation
### docker
```
docker compose up -d
```
### manual
```
cd web
npm install
npm start
```

## database
Workhours history is stored in json files in the `web/db` directory.
Each file represents a month and is named `history-YYYY-MM.json`.