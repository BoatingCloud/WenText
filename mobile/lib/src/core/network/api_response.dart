import 'package:dio/dio.dart';
import '../constants/app_constants.dart';
import '../constants/env_config.dart';
import '../storage/storage_service.dart';

/// API响应模型
class ApiResponse<T> {
  final bool success;
  final T? data;
  final String? message;
  final String? code;
  final Map<String, dynamic>? details;
  final PaginationInfo? pagination;

  ApiResponse({
    required this.success,
    this.data,
    this.message,
    this.code,
    this.details,
    this.pagination,
  });

  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(dynamic)? fromJsonT,
  ) {
    return ApiResponse<T>(
      success: json['success'] ?? false,
      data: json['data'] != null && fromJsonT != null
          ? fromJsonT(json['data'])
          : json['data'],
      message: json['message'],
      code: json['code'],
      details: json['details'],
      pagination: json['pagination'] != null
          ? PaginationInfo.fromJson(json['pagination'])
          : null,
    );
  }
}

/// 分页信息
class PaginationInfo {
  final int page;
  final int pageSize;
  final int total;
  final int totalPages;

  PaginationInfo({
    required this.page,
    required this.pageSize,
    required this.total,
    required this.totalPages,
  });

  factory PaginationInfo.fromJson(Map<String, dynamic> json) {
    return PaginationInfo(
      page: json['page'] ?? 1,
      pageSize: json['pageSize'] ?? 20,
      total: json['total'] ?? 0,
      totalPages: json['totalPages'] ?? 0,
    );
  }
}
