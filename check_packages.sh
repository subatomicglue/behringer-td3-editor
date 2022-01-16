#!/bin/bash

function getPlatform {
  local platform=`uname`   # Darwin, Linux
  local machine=`uname -m` # armv7l, x86_64
  local nodename=`uname -n` # machinename, e.g. raspberrypi
  echo $platform
}

# install a package using generic package mgr
function genericCheck {
  local needs_sudo="$1"
  local packagemgr="$2"
  local packagename="$3"
  local appname="${4:-0}"
  if [ $appname == 0 ]; then
    appname="$packagename"
  fi

  which $packagemgr > /dev/null
  if [ $? != 0 ]; then
    echo "$packagemgr is not on this system!"
    exit -1
  fi

  echo "[$packagemgr] Checking that $appname is installed"
  which $appname > /dev/null
  if [ $? != 0 ]; then
    if [ $needs_sudo == 1 ]; then
      sudo $packagemgr install $packagename
    else
      $packagemgr install $packagename
    fi
  fi

  which $appname > /dev/null
  if [ $? != 0 ]; then
    echo "[$packagemgr] Install of '$packagename', FAILED, '$appname' not found"
    exit -1
  fi
}

# install a package using brew
function brewCheck {
  genericCheck 0 "brew" $1 $2
}

# install a package using apt-get
function aptCheck {
  genericCheck 1 "apt-get" $1 $2
}

# install a package using yum
function yumCheck {
  genericCheck 1 "yum" $1 $2
}

function packageCheck {
  local platform=`getPlatform`
  if [ $platform == "Darwin" ]; then
    brewCheck $1 $2
  elif [ $platform == "Linux" ]; then
    aptCheck $1 $2
  fi
}

# install gem packages
function rubyCheck {
  local packagename="$1"
  local appname="${2:-0}"
  if [ $appname == 0 ]; then
    appname="$packagename"
  fi

  which gem > /dev/null
  if [ $? != 0 ]; then
    packageCheck ruby gem
  fi

  echo "[ruby] Checking that $appname is installed"
  which $appname > /dev/null
  if [ $? != 0 ]; then
    sudo gem install $packagename
  fi

  which $appname > /dev/null
  if [ $? != 0 ]; then
    echo "[ruby] Install of '$packagename', FAILED, '$appname' not found"
  fi
}

rubyCheck fpm
packageCheck rpm
packageCheck squashfs mksquashfs

