<!-- @format -->

# Osmosis local dev env in docker

## Requirements

First and foremost: this is a process tested from scratch and working on a Linux laptop (Ubuntu 20.04.4 LTS).
Other operating systems such as MacOS and Windows would need to be tested.

Software required:

- `docker-ce`
- `docker-compose`

## Create directory structure

On a working directory of your choice, run the following:

```
mkdir -p OsmosisKD/.conf
cd OsmosisKD
```

## Clone required repos

```
git clone git@github.com:OsmosisKD/fusion
git clone git@github.com:OsmosisKD/megagrid
git clone git@github.com:OsmosisKD/osmosis
git clone git@github.com:OsmosisKD/osmosis_static
git clone git@github.com:OsmosisKD/osmosis_schedules
git clone git@github.com:OsmosisKD/osmosis_database
```

## Install node dependencies

:warning: **Zscaler Internet Security** must be disabled for the next step, otherwise you'll run into issues.
Zscaler Private Access can remain ON.

Now proceed to install the dependencies:

```
cd osmosis
npm install --production=false
node run pullassets
cd ..
```

## Pull docker images

`docker-compose pull`

Ignore the errors of not being able to pull `webpack` and `admin`. They'll use the image built for `www`.

## Build docker images

`docker-compose build mariadb neptune www`

## Start services

`docker-compose up -d mariadb elasticsearch redis neptune`

Wait for `mariadb` service to be up and running (the 1st time it takes a minute or two as it has to set up the schemas and data).
You should see an entry from `docker-compose logs mariadb` which looks as follows:

```
mariadb_1        | 2022-05-04T14:27:20.083866870Z 2022-05-04 14:27:20 0 [Note] mariadbd: ready for connections.
```

:information_source: Osmosis (`www` service) depends on `mariadb` to be **fully ready**.

## Spin up the environment

#### Only on 1st run:

1. Uncomment `services.www.command:` so it contains: `command: ./cache ignore`
1. Then run `docker-compose up www`. Wait for the cache to be built and stored in the docker volume (around 15 mins). Around 30 minutes if using AWS services (this is currently being investigated as of 18th of May 2022).
1. Stop the `www` service pressing `Ctrl-C`.
1. Comment out the `services.www.command:` option now (the image will default to `node osmosis` which is how the app is started.

#### Subsequent runs (cache already built and stored)

Assuming you didn't stop the other services, just run `docker-compose up www` (or `docker-compose up -d www` to send it to the background).

If you stopped other services, now that both database has the data populated, and that the cache was built, you can start up the whole stack
by running `docker-compose up` (or `docker-compose up -d` to send it to the background).

Local development environment should now be ready. Browse http://localhost:3000/ and the Osmosis site should load.

## Admin service

By default the admin component will run on `localhost:3005`. To access the admin interface locally, one needs to perform a series of steps first:

1. Create an account on the main site (`localhost:3000`)
   - To verify the email locally, after registration go to `http://localhost:3000/verify/YOUR_EMAIL_WITHOUT_@` (e.g. `http://localhost:3000/verify/p.g.alvarezelsevier.com`).
1. Complete your profile. In order to test Neptune too, it's better to select an "MD" profile.
1. Once finished the registration and activation, find out your user ID on the database:
   - `docker-compose exec mariadb mysql -e "select UserID from osmosis.users where LastName = 'Garcia'\G";`
   - I used the "LastName" field to search for my last name. If multiple results, just pick the last one (newest).
1. Edit `.env.local` values under "# Users stuff" and replace all those IDs with yours.
1. Restart the `admin` service (`docker-compose restart admin`). Make sure the values in `.env.local` are correct, otherwise `docker-compose down` then up again.
1. Assuming you are already logged in to the main site `localhost:3000`, then just go to the admin site `localhost:3005` and you should see the admin panel.

This process only has to be done once if using docker volumes or a persistent database.

## A note on rebuilding caches

All caches built here https://github.com/OsmosisKD/osmosis/blob/master/routes/run/admin/refreshConcepts.js#L141-L217 can be built using:
`./cache <cache_name>` (or `./cache ignore` to rebuild all).

E.g. `./cache newNavs`

Re-building an existing cache takes around 16 minutes when using all services **locally**:

```
www_1            | Building megagrid...
www_1            | 2022-05-26 09:13:55.354: [local/osmosis/app/videoEncryptionCache.js:165] exports.build  Video encryption cache built @ Thu May 26 2022 09:13:55 GMT+0000 (Coordinated Universal Time)
www_1            | 2022-05-26 09:13:59.572: [local/osmosis/learn/check.js:19] module.exports  [
...
www_1            | 2022-05-26 09:29:32.044: [local/osmosis/navigator/fixConceptNames.js:22] anonymous  NOT FOUND: Dextromethorphan
www_1            | Done building megagrid.
osmosiskd_www_1 exited with code 0
```

Building it from scratch takes more time (around 30-35 minutes).

:warning: If using AWS services as highlighted at the bottom of this page, it takes even more time do to sizing of instances and network bottlenecks.

## A note on configuration files

`docker-compose.yaml`'s `www` service **MUST** have the following environment variable set:

```
    environment:
      NODE_ENV: local
```

Otherwise, it won't pick up the correct config file(s).

Theoretically, the order of priority when loading config files is:

1. `osmosis/.env.local` - Loaded if present, but not mandatory
1. `osmosis/.env` - Only if the former is not present
1. `.conf/osmosis.js` (well, `.conf/<service>.js`) - Loaded nevertheless

But I run into issues if only used the first option, or the last one, as theoretically only one of them is needed.
That's not the case, both the `.env` (or `.env.local`) **and** `osmosis.js` are needed at the same time.

It's unclear to me what variables are read from what file, so both files have all the same variables pretty much.

A few notes on some specific variables:

- `REDIS_URL` seemed to only work when added to `osmosis.js` and not when added to `.env.local`.
- `DBHost` was missing, and by default it uses `localhost`. Added it to specify the docker service.

## Run using specific parts from the AWS NONPROD environment

:warning: This works really slow at the moment due to several factors (instance sizes, networking, poorly optimized queries in the code...).
As an experiment is a nice to have, but try to either run the development environment fully locally, or fully on AWS, not a mix.

Comment out the services and the osmosis' www dependency on them, then update the
configuration files accordingly:

### MariaDB

On `.conf/osmosis.js` and `.env.local` files, edit the following values:

```
DBHost
DBUsername
DBPassword
```

To get those values:

- `aws ssm get-parameter --name /osmosis/dev/rds/osmosis-dev/endpoint --query Parameter.Value --output text`
- `aws secretsmanager get-secret-value --secret-id osmosis-dev-sm-rotation_tmtu --query SecretString`

### REDIS

Endpoint: `aws ssm get-parameter --name /osmosis/dev/redis/osmosis-dev/endpoint --query Parameter.Value --output text`

On `.env.local` find and replace `REDIS_URL` with the value obtained above.

### Neptune

Endpoint: `aws ssm get-parameter --name /osmosis/dev/neptune/osmosis-dev/endpoint --query Parameter.Value --output text`

On `.env.local` find and replace `graphDBURI` with the value obtained above.

NOTE: Use `http` instead of websocket (`ws`). e.g. `graphDBURI="https://osmosis-dev.cluster-cl5ksxdmiho3.us-east-2.neptune.amazonaws.com:8182/gremlin"`

### ElasticSearch

Endpoint: `aws ssm get-parameter --name /osmosis/dev/elasticsearch/osmosis-dev-private/endpoint --query Parameter.Value --output text`

On `.env.local` find and replace `amazonElasticSearch` with the value obtained above.
