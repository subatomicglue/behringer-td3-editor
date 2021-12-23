
# pi hardware
USER=pi
HOST=raspberrypi.local
PORT=22
INSTALL_DIR="/home/pi/td3"
EXE="SubatomicTD3ditor"
APPNAME="Subatomic TD3"

# qemu
#USER=pi
#HOST=localhost
#PORT=2222

args=()
VERBOSE=false

################################
# scan command line args:
function usage
{
  echo "$0 setup rpi $HOST"
  echo "Usage: "
  echo "  $0               (default)"
  echo "  $0 --help        (this help)"
  echo "  $0 --verbose     (output verbose information)"
  echo ""
}
usage
ARGC=$#
ARGV=("$@")
non_flag_args=0
non_flag_args_required=0
for ((i = 0; i < ARGC; i++)); do
  if [[ $ARGC -ge 1 && ${ARGV[$i]} == "--help" ]]; then
    usage
    exit -1
  fi
  if [[ $ARGC -ge 1 && ${ARGV[$i]} == "--verbose" ]]; then
    VERBOSE=true
    continue
  fi
  if [[ $ARGC -ge 1 && ${ARGV[$i]:0:2} == "--" ]]; then
    echo "Unknown option ${ARGV[$i]}"
    exit -1
  fi

  # general non -- args
  args+=("${ARGV[$i]}")
  $VERBOSE && echo "Parsing Args: \"${ARGV[$i]}\""
  ((non_flag_args+=1))
done

# output help if they're getting it wrong...
if [ $non_flag_args_required -ne 0 ] && [[ $ARGC -eq 0 || ! $ARGC -ge $non_flag_args_required ]]; then
  [ $ARGC -gt 0 ] && echo "Expected $non_flag_args_required args, but only got $ARGC"
  usage
  exit -1
fi
################################

echo ""
echo "We assume you have already:
- created a Raspian drive (e.g. MicroSD or USB) with setup_image_buster.sh
- setup internet sharing in SystemPreferences/Sharing/InternetSharing
- connected the drive into the Rpi
- connected the Rpi to your mac with network cable and booted it up,
  allowing time for partition to resize (dont disconnect power during this!)
"
echo ""
read -p "Press enter to continue"

apt_get="sudo DEBIAN_FRONTEND=noninteractive apt-get -yq --allow-unauthenticated --allow-downgrades --allow-change-held-packages --allow-remove-essential "
apt="sudo DEBIAN_FRONTEND=noninteractive apt -yq --allow-unauthenticated --allow-downgrades --allow-change-held-packages --allow-remove-essential "

source "../vstdev/MantisSynth/rpi/common.sh"

echo ""
echo "Icon launcher for the app"
writeText2File '#!/bin/bash
PID="$(pidof $EXE)"
if [  "$PID" != ""  ]; then
  kill $PID
else
 DISPLAY=:0.0 "$INSTALL_DIR/release/linux-armv7l-unpacked/$EXE" &
fi
' "/usr/bin/toggle-$EXE.sh"

remoteCmd "sudo chmod +x /usr/bin/toggle-$EXE.sh"

copyFile2FileAsRoot rpi-icon.png "/usr/share/pixmaps/$EXE-rpi-icon.png"
writeText2File "[Desktop Entry]
Name=Toggle $APPNAME
Comment=Toggle $APPNAME
Exec=/usr/bin/toggle-$EXE.sh
Type=Application
Icon=$EXE-rpi-icon.png
Categories=Panel;Utility;MB
X-MB-INPUT-MECHANISM=True
" "/usr/share/raspi-ui-overrides/applications/toggle-$EXE.desktop"


remoteCmd "cp /etc/xdg/lxpanel/LXDE-pi/panels/panel /home/pi/.config/lxpanel/LXDE-pi/panels/panel"

appendText2ToFile "
Plugin {
  type=launchbar
  Config {
    Button {
      id=toggle-keyboard.desktop
    }
  }
}
Plugin {
  type=launchbar
  Config {
    Button {
      id=toggle-$EXE.desktop
    }
  }
}
" "/home/pi/.config/lxpanel/LXDE-pi/panels/panel"

writeText2File "[Desktop Entry]
Name=TD3 Editor
Comment=TD3 Editor
Icon=/usr/share/pixmaps/$EXE-rpi-icon.png
Exec=$INSTALL_DIR/release/linux-armv7l-unpacked/$EXE
Type=Application
Encoding=UTF-8
Terminal=false
" "/home/pi/Desktop/$APPNAME.desktop"

remoteCmd "sudo chmod 755 'Desktop/$APPNAME.desktop'; sudo chown pi 'Desktop/$APPNAME.desktop'; sudo chgrp pi 'Desktop/$APPNAME.desktop'"

remoteCmd "/usr/bin/toggle-$EXE.sh"

# DISPLAY=:0 matchbox-keyboard &



#echo "Now, try logging in with:  ssh -p$PORT $USER@$HOST"
#ssh -p$PORT $USER@$HOST

