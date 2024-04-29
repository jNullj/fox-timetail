## fox-timetail

Fox-TimeTail, tailing your work-time, is a webapp (with a planned Android Wear app as well) that aims to provide an easy way to track work hours.

features:
- [x] clock in and out in a sipmle UI
- [x] display history - basic, will be improved
- [] add breaks
- [] add notes
- [x] webapp for mobile and desktop
- [] offline mode - WIP
- [] export formats: TBD
- [] import fromats: TBD

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