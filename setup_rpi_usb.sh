
# pi hardware
USER=pi
HOST=raspberrypi.local
PORT=22

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

# remoteCmd "$apt_get install \"xxxx\""


source "../vstdev/MantisSynth/rpi/common.sh"

echo ""
echo "Write access to the USB /media mount point"
remoteCmd "sudo chown pi:pi /media ; sudo chmod 777 /media"
echo "Write access to the USB /media/pi mount point"
remoteCmd "sudo chown pi:pi /media/pi ; sudo chmod 777 /media/pi"

echo ""
echo "Rename USB user storage drive"
remoteCmd "ls /dev/sda1 > /dev/null 2>&1"
if [ "$?" != 0 ]; then
  echo "Please insert a USB drive, FAT32 formatted"
  exit -1
fi
echo "- Checking mtools is present (for mlabel)"
remoteInstall "mtools" # mtools has mlabel in it
echo "- Rename USB user storage drive to USB"
remoteCmd "sudo mlabel -i /dev/sda1 ::USB; sudo umount --quiet /dev/sda1; mkdir -p /media/pi/USB; sudo mount -o uid=\`id -u pi\`,gid=\`id -g pi\` /dev/sda1 /media/pi/USB"
#echo "- Write access to the USB /media/pi/USB mount point"
#remoteCmd "sudo chown pi:pi /media/pi/USB ; sudo chmod 777 /media/pi/USB"
echo "- Checking success"
remoteCmd "ls /media/pi/USB > /dev/null 2>&1"
if [ "$?" != 0 ]; then
  echo "We tried to change the drive label on /dev/sda1 to 'USB', but it failed"
  echo "Please insert a USB drive, FAT32 formatted"
  exit -1
fi


echo ""
echo "Add USB to fstab, make it permanent"
enableLine "/dev/sda1	/media/pi/USB	vfat	uid=pi,gid=pi	0	0" /etc/fstab


