#
# Copyright (c) 2015, Joyent, Inc.
#

#
# Makefile for the V8 MDB dmod.  This build produces 32-bit and 64-bit binaries
# for mdb_v8 in the "build" directory.
#
# Targets:
#
#     all	builds the mdb_v8.so shared objects
#
#     check	run style checker on source files
#
#     clean	removes all generated files
#
# This Makefile has been designed to work out of the box (without manual or
# automatic configuration) on illumos systems.  Other systems do not support
# MDB, so the build will not work there.  In principle, you can change most
# of the items under the CONFIGURATION sections, but you should not need to.
#

#
# CONFIGURATION FOR BUILDERS
#

# Directory for output objects
MDBV8_BUILD	 = build

# Output object name
MDBV8_SONAME	 = mdb_v8.so


#
# CONFIGURATION FOR DEVELOPERS
#

#
# List of source files that will become objects.  (These entries do not include
# the "src/" directory prefix.)
#
MDBV8_SOURCES		 = mdb_v8.c mdb_v8_cfg.c

# List of source files to run through cstyle.  This includes header files.
MDBV8_CSTYLE_SOURCES	 = $(wildcard src/*.c src/*.h)

# Compiler flags
CFLAGS			+= -Werror -Wall -Wextra -fPIC -fno-omit-frame-pointer
# XXX These should be removed.
CFLAGS			+= -Wno-unused-parameter		\
			   -Wno-missing-field-initializers	\
			   -Wno-sign-compare 

# Linker flags (including dependent libraries)
LDFLAGS			+= -lproc -lavl
SOFLAGS			 = -Wl,-soname=$(MDBV8_SONAME)

# Path to cstyle.pl tool
CSTYLE			 = tools/cstyle.pl
CSTYLE_FLAGS		+= -cCp


#
# INTERNAL DEFINITIONS
#
MDBV8_ARCH = ia32
include Makefile.arch.defs
MDBV8_ARCH = amd64
include Makefile.arch.defs

$(MDBV8_TARGETS_amd64):	CFLAGS	+= -m64
$(MDBV8_TARGETS_amd64):	SOFLAGS	+= -m64

#
# DEFINITIONS USED AS RECIPES
#
MKDIRP		 = mkdir -p $@
COMPILE.c	 = $(CC) -o $@ -c $(CFLAGS) $(CPPFLAGS) $^
MAKESO	 	 = $(CC) -o $@ -shared $(SOFLAGS) $(LDFLAGS) $^

#
# TARGETS
#
.PHONY: all
all: $(MDBV8_ALLTARGETS)

.PHONY: check
check:
	$(CSTYLE) $(CSTYLE_FLAGS) $(MDBV8_CSTYLE_SOURCES)

.PHONY: clean
clean:
	-rm -rf $(MDBV8_BUILD)

#
# Makefile.arch.targ is parametrized by MDBV8_ARCH.  It defines a group of
# the current value of MDBV8_ARCH.  When we include it the first time, it
# defines targets for the 32-bit object files and shared object file.  The
# second time, it defines targets for the 64-bit object files and shared object
# file.  This avoids duplicating Makefile snippets, though admittedly today
# these snippets are short enough that it hardly makes much difference.
#
MDBV8_ARCH=ia32
include Makefile.arch.targ
MDBV8_ARCH=amd64
include Makefile.arch.targ