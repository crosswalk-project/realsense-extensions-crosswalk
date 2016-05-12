## How to start/stop?
Click the `START`/`STOP` button on top side of the right panel.

Before clicking `START`, you can manipulate the `CONFIGURATION` area to provide an initial set of configurations to start face module. Of course, untouched configurations will take default values.

## How to switch resolution/fps while running?
`STOP` current running face module, re-select your favored resolution/fps, and then `START` again.

## How to manipulate configurations?
You can freely modify the configuration items in `CONFIGURATION` area while face module is running, but you need to click `APPLY` button to apply them be effective.

Clicking `DEFAULT` button will get default configuration settings and display them in `CONFIGURATION` area.

Clicking `REVERT` button will get current configuration settings and display them in `CONFIGURATION` area.

## How to run face recognition?
Enable face recognition feature by `RECOGNITION` `ENABLE` configuration, then you can find the recognized ID at left-bottom of the rectangle displayed on every detected face.

If `Not Registered` displayed instead, it means the face is not recognized from current face recognition database.

## Face ID? Recognition ID?
Face ID: at left-top of the rectangle displayed on every detected face, this is a unique id for every detected face throughout current face detection session.

Recognition ID: at left-bottom of the rectangle displayed on every detected face, this is a recognized id from current face recognition database.

For example, if Tom leave current FOV and back again, he will get a different Face ID, but the same Recognition ID.

## How to register face into database?
Set Face ID into `Face ID` and then click `REGISTER` button.

## How to unregister face from database?
Set Recognition ID into `RECOG ID` and then click `UNREGISTER` button.

## Is the face recognition database persistable?
No. Once `STOP`, the current face recognition database will disappear.

## Can all the configurations be changed freely while face module running?
Yes for all, only except `TRACKING MODE` configuration.
