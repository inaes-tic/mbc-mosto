mbc-mosto
=========

@mbc-playout's playlist juggler

Requirements
============
* NodeJS 0.8+
* node-gyp

Install Melted
==============

```bash
sudo aptitude install melt libmlt-dev libmlt++-dev
git clone git://github.com/mltframework/melted.git
cd melted
configure --prefix=/usr
make
make install
```

Install MongoDB (if planning to use it with Caspa)
==================================================

```bash
sudo aptitude install mongodb
```

Install MBC-Mosto
=================

```bash
git clone git@github.com:inaes-tic/mbc-mosto.git
cd mbc-mosto
make install
```

Testing MBC-Mosto
=================

```bash
cd mbc-mosto
make test
```

Start MBC-Mosto Server
======================

```bash
cd mbc-mosto
make serve
```

