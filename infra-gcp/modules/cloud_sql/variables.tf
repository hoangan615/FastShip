variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "environment_name" {
  type = string
}

variable "admin_password" {
  type      = string
  sensitive = true
}
