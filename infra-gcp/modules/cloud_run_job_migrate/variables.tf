variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "environment_name" {
  type = string
}

variable "image" {
  type = string
}

variable "runtime_service_account_email" {
  type = string
}

variable "vpc_connector_id" {
  type = string
}

variable "secret_ids" {
  type = map(string)
}
