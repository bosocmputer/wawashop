build_docker_dev:
	docker build -t $(DOCKER_DEV_IMAGE) -f Dockerfile.dev .

build_docker_prod:
	docker build -t $(DOCKER_PROD_IMAGE) -f Dockerfile.prod .

